/**
 * RobotCommandBridge — Sends real commands to the robot via Bluetooth Serial, WebSocket, and/or HTTP.
 * 
 * Features:
 * - Multi-channel dispatch with priority: BT → WS → HTTP
 * - Automatic retry with exponential backoff per channel
 * - Fallback cascade: if primary channel fails, tries next
 * - Auto-reconnect during delivery flow
 * - Real-time position reading from BT sensor data
 * 
 * Protocol: JSON commands over serial (BT SPP/BLE) or WebSocket, newline-terminated.
 */

export interface RobotCommand {
  action: string;
  params?: Record<string, any>;
  timestamp: number;
}

export interface CommandResult {
  success: boolean;
  channel: 'bluetooth' | 'websocket' | 'http' | 'none';
  response?: string;
  error?: string;
  latencyMs?: number;
  retries?: number;
}

export interface RobotPosition {
  x: number;
  y: number;
  theta: number;
  timestamp: number;
  source: 'bluetooth' | 'websocket' | 'simulated';
}

type LogFn = (msg: string, level: 'info' | 'success' | 'warning' | 'error') => void;
type PositionCallback = (pos: RobotPosition) => void;

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY: RetryConfig = { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000 };

/**
 * Known command templates for CT300-series robots.
 */
export const ROBOT_COMMANDS = {
  goto: (x: number, y: number, theta = 0) => ({
    action: 'goto',
    params: { target_x: x, target_y: y, target_theta: theta, speed: 0.5 },
    timestamp: Date.now(),
  }),
  pause: () => ({ action: 'pause', params: {}, timestamp: Date.now() }),
  resume: () => ({ action: 'resume', params: {}, timestamp: Date.now() }),
  stop: () => ({ action: 'stop', params: {}, timestamp: Date.now() }),
  emergencyStop: () => ({ action: 'emergency_stop', params: { force: true }, timestamp: Date.now() }),
  returnToBase: () => ({
    action: 'goto',
    params: { target_x: 0, target_y: 0, target_theta: 0, speed: 0.3, label: 'base' },
    timestamp: Date.now(),
  }),
  queryStatus: () => ({ action: 'query_status', params: {}, timestamp: Date.now() }),
  queryPosition: () => ({ action: 'query_position', params: {}, timestamp: Date.now() }),
  setLed: (color: string, mode: 'solid' | 'blink' = 'solid') => ({
    action: 'set_led',
    params: { color, mode },
    timestamp: Date.now(),
  }),
} as const;

export class RobotCommandBridge {
  private btSendFn: ((data: string) => Promise<boolean>) | null = null;
  private wsSendFn: ((data: any) => void) | null = null;
  private httpBaseUrl: string | null = null;
  private onLog: LogFn = () => {};
  private commandHistory: Array<{ cmd: RobotCommand; result: CommandResult }> = [];
  private retryConfig: RetryConfig = DEFAULT_RETRY;

  // Position tracking
  private lastPosition: RobotPosition = { x: 0, y: 0, theta: 0, timestamp: 0, source: 'simulated' };
  private onPositionUpdate: PositionCallback | null = null;
  private positionPollInterval: ReturnType<typeof setInterval> | null = null;

  // Reconnect
  private btReconnectFn: (() => Promise<boolean>) | null = null;
  private wsReconnectFn: (() => void) | null = null;
  private channelFailures: Record<string, number> = { bluetooth: 0, websocket: 0, http: 0 };

  attachBluetooth(sendFn: (data: string) => Promise<boolean>) {
    this.btSendFn = sendFn;
    this.channelFailures.bluetooth = 0;
  }

  attachBluetoothReconnect(reconnectFn: () => Promise<boolean>) {
    this.btReconnectFn = reconnectFn;
  }

  attachWebSocket(sendFn: (data: any) => void) {
    this.wsSendFn = sendFn;
    this.channelFailures.websocket = 0;
  }

  attachWebSocketReconnect(reconnectFn: () => void) {
    this.wsReconnectFn = reconnectFn;
  }

  attachHttp(robotIP: string, port = 8080) {
    this.httpBaseUrl = `http://${robotIP}:${port}`;
    this.channelFailures.http = 0;
  }

  setLogger(fn: LogFn) { this.onLog = fn; }

  setRetryConfig(config: Partial<RetryConfig>) {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  // --- Position Tracking ---

  onPosition(cb: PositionCallback) { this.onPositionUpdate = cb; }

  getLastPosition(): RobotPosition { return { ...this.lastPosition }; }

  /** Parse incoming BT/WS data for position updates */
  handleIncomingData(data: string, source: 'bluetooth' | 'websocket') {
    try {
      const parsed = JSON.parse(data);
      if (parsed.x !== undefined && parsed.y !== undefined) {
        this.lastPosition = {
          x: parseFloat(parsed.x) || 0,
          y: parseFloat(parsed.y) || 0,
          theta: parseFloat(parsed.theta) || 0,
          timestamp: Date.now(),
          source,
        };
        this.onPositionUpdate?.(this.lastPosition);
      }
      // Also handle position nested in a response
      if (parsed.position && parsed.position.x !== undefined) {
        this.lastPosition = {
          x: parseFloat(parsed.position.x) || 0,
          y: parseFloat(parsed.position.y) || 0,
          theta: parseFloat(parsed.position.theta) || 0,
          timestamp: Date.now(),
          source,
        };
        this.onPositionUpdate?.(this.lastPosition);
      }
    } catch { /* not JSON or no position data */ }
  }

  /** Start polling position from BT at given interval */
  startPositionPolling(intervalMs = 1000) {
    this.stopPositionPolling();
    this.positionPollInterval = setInterval(async () => {
      await this.sendCommand(ROBOT_COMMANDS.queryPosition(), { silent: true });
    }, intervalMs);
    this.onLog('📍 Polling de posição BT iniciado', 'info');
  }

  stopPositionPolling() {
    if (this.positionPollInterval) {
      clearInterval(this.positionPollInterval);
      this.positionPollInterval = null;
    }
  }

  // --- Resilient Command Dispatch ---

  private async delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  private getBackoffDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay + Math.random() * 200, this.retryConfig.maxDelayMs);
  }

  /** Try to reconnect a failed channel */
  private async tryReconnect(channel: 'bluetooth' | 'websocket'): Promise<boolean> {
    if (channel === 'bluetooth' && this.btReconnectFn) {
      this.onLog('🔄 Tentando reconexão Bluetooth...', 'warning');
      const ok = await this.btReconnectFn();
      if (ok) {
        this.channelFailures.bluetooth = 0;
        this.onLog('✓ Bluetooth reconectado', 'success');
      }
      return ok;
    }
    if (channel === 'websocket' && this.wsReconnectFn) {
      this.onLog('🔄 Tentando reconexão WebSocket...', 'warning');
      this.wsReconnectFn();
      await this.delay(1000); // give WS time to connect
      this.channelFailures.websocket = 0;
      return true;
    }
    return false;
  }

  /**
   * Send command with retry + fallback cascade BT → WS → HTTP.
   */
  async sendCommand(cmd: RobotCommand, opts?: { silent?: boolean }): Promise<CommandResult> {
    const encoded = JSON.stringify(cmd) + '\n';
    const start = Date.now();
    const silent = opts?.silent ?? false;
    let totalRetries = 0;

    // Channel priority order
    const channels: Array<{
      name: 'bluetooth' | 'websocket' | 'http';
      available: boolean;
      send: () => Promise<{ success: boolean; response?: string }>;
    }> = [
      {
        name: 'bluetooth',
        available: !!this.btSendFn,
        send: async () => {
          const ok = await this.btSendFn!(encoded);
          return { success: ok };
        },
      },
      {
        name: 'websocket',
        available: !!this.wsSendFn,
        send: async () => {
          this.wsSendFn!({ type: 'navigate', data: cmd, timestamp: Date.now() });
          return { success: true };
        },
      },
      {
        name: 'http',
        available: !!this.httpBaseUrl,
        send: async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(`${this.httpBaseUrl}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cmd),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const text = await res.text().catch(() => '');
          return { success: res.ok, response: text };
        },
      },
    ];

    for (const channel of channels) {
      if (!channel.available) continue;

      // Skip channels with too many consecutive failures (try reconnect first)
      if (this.channelFailures[channel.name] >= 3) {
        if (channel.name !== 'http') {
          const reconnected = await this.tryReconnect(channel.name as 'bluetooth' | 'websocket');
          if (!reconnected) continue;
        } else {
          continue;
        }
      }

      // Retry loop per channel
      for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
        try {
          if (!silent) {
            const icon = channel.name === 'bluetooth' ? '🔵' : channel.name === 'websocket' ? '🟢' : '🟠';
            if (attempt > 0) {
              this.onLog(`${icon} ${channel.name.toUpperCase()} retry #${attempt} → ${cmd.action}`, 'warning');
            } else {
              this.onLog(`${icon} ${channel.name.toUpperCase()} → ${cmd.action} ${JSON.stringify(cmd.params || {})}`, 'info');
            }
          }

          const res = await channel.send();
          if (res.success) {
            this.channelFailures[channel.name] = 0;
            const result: CommandResult = {
              success: true,
              channel: channel.name,
              response: res.response,
              latencyMs: Date.now() - start,
              retries: totalRetries,
            };
            if (!silent) {
              this.onLog(`✓ ${channel.name.toUpperCase()}: ${cmd.action} (${result.latencyMs}ms${totalRetries > 0 ? `, ${totalRetries} retries` : ''})`, 'success');
            }
            this.commandHistory.push({ cmd, result });
            return result;
          }
          throw new Error('Channel returned failure');
        } catch (err) {
          totalRetries++;
          this.channelFailures[channel.name]++;
          if (!silent) {
            this.onLog(`⚠ ${channel.name.toUpperCase()} falhou: ${(err as Error).message}`, 'warning');
          }
          if (attempt < this.retryConfig.maxRetries) {
            const backoff = this.getBackoffDelay(attempt);
            if (!silent) this.onLog(`  ⏳ Aguardando ${Math.round(backoff)}ms antes do retry...`, 'info');
            await this.delay(backoff);
          }
        }
      }

      if (!silent) {
        this.onLog(`✗ ${channel.name.toUpperCase()} esgotou retries para ${cmd.action}, tentando próximo canal...`, 'warning');
      }
    }

    // All channels failed
    const result: CommandResult = {
      success: false,
      channel: 'none',
      error: 'Todos os canais falharam após retries',
      latencyMs: Date.now() - start,
      retries: totalRetries,
    };
    if (!silent) {
      this.onLog(`✗ ${cmd.action}: todos os canais falharam (${totalRetries} retries totais)`, 'error');
    }
    this.commandHistory.push({ cmd, result });
    return result;
  }

  // Convenience methods
  async goto(x: number, y: number, theta = 0) { return this.sendCommand(ROBOT_COMMANDS.goto(x, y, theta)); }
  async pause() { return this.sendCommand(ROBOT_COMMANDS.pause()); }
  async resume() { return this.sendCommand(ROBOT_COMMANDS.resume()); }
  async stop() { return this.sendCommand(ROBOT_COMMANDS.stop()); }
  async emergencyStop() { return this.sendCommand(ROBOT_COMMANDS.emergencyStop()); }
  async returnToBase() { return this.sendCommand(ROBOT_COMMANDS.returnToBase()); }
  async queryStatus() { return this.sendCommand(ROBOT_COMMANDS.queryStatus()); }
  async queryPosition() { return this.sendCommand(ROBOT_COMMANDS.queryPosition()); }

  getHistory() { return [...this.commandHistory]; }

  hasAnyChannel(): boolean {
    return !!(this.btSendFn || this.wsSendFn || this.httpBaseUrl);
  }

  getAvailableChannels(): string[] {
    const channels: string[] = [];
    if (this.btSendFn) channels.push('Bluetooth');
    if (this.wsSendFn) channels.push('WebSocket');
    if (this.httpBaseUrl) channels.push('HTTP');
    return channels;
  }

  getChannelHealth(): Record<string, { failures: number; healthy: boolean }> {
    return {
      bluetooth: { failures: this.channelFailures.bluetooth, healthy: this.channelFailures.bluetooth < 3 },
      websocket: { failures: this.channelFailures.websocket, healthy: this.channelFailures.websocket < 3 },
      http: { failures: this.channelFailures.http, healthy: this.channelFailures.http < 3 },
    };
  }

  destroy() {
    this.stopPositionPolling();
  }
}
