/**
 * RobotCommandBridge — Sends real commands to the robot via Bluetooth Serial and/or HTTP/WebSocket.
 * 
 * This bridge translates delivery flow actions into actual robot commands,
 * supporting dual-channel (BT + WS) for redundancy.
 * 
 * Protocol: JSON commands over serial (BT SPP/BLE) or WebSocket, newline-terminated.
 * 
 * TODO: Adjust command format when official robot API documentation is confirmed.
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
}

type LogFn = (msg: string, level: 'info' | 'success' | 'warning' | 'error') => void;

/**
 * Known command templates for CT300-series robots.
 * These are best-guess formats based on common delivery robot protocols.
 * TODO: Replace with confirmed API when protocol docs are available.
 */
export const ROBOT_COMMANDS = {
  goto: (x: number, y: number, theta = 0) => ({
    action: 'goto',
    params: { target_x: x, target_y: y, target_theta: theta, speed: 0.5 },
    timestamp: Date.now(),
  }),
  pause: () => ({
    action: 'pause',
    params: {},
    timestamp: Date.now(),
  }),
  resume: () => ({
    action: 'resume',
    params: {},
    timestamp: Date.now(),
  }),
  stop: () => ({
    action: 'stop',
    params: {},
    timestamp: Date.now(),
  }),
  emergencyStop: () => ({
    action: 'emergency_stop',
    params: { force: true },
    timestamp: Date.now(),
  }),
  returnToBase: () => ({
    action: 'goto',
    params: { target_x: 0, target_y: 0, target_theta: 0, speed: 0.3, label: 'base' },
    timestamp: Date.now(),
  }),
  queryStatus: () => ({
    action: 'query_status',
    params: {},
    timestamp: Date.now(),
  }),
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

  /**
   * Attach real transport functions from hooks.
   */
  attachBluetooth(sendFn: (data: string) => Promise<boolean>) {
    this.btSendFn = sendFn;
  }

  attachWebSocket(sendFn: (data: any) => void) {
    this.wsSendFn = sendFn;
  }

  attachHttp(robotIP: string, port = 8080) {
    this.httpBaseUrl = `http://${robotIP}:${port}`;
  }

  setLogger(fn: LogFn) {
    this.onLog = fn;
  }

  /**
   * Send a command to the robot via all available channels.
   * Returns the result of the first successful channel.
   */
  async sendCommand(cmd: RobotCommand): Promise<CommandResult> {
    const encoded = JSON.stringify(cmd) + '\n';
    const start = Date.now();

    // 1. Try Bluetooth Serial (lowest latency, direct connection)
    if (this.btSendFn) {
      try {
        this.onLog(`🔵 BT → ${cmd.action} ${JSON.stringify(cmd.params || {})}`, 'info');
        const ok = await this.btSendFn(encoded);
        if (ok) {
          const result: CommandResult = {
            success: true,
            channel: 'bluetooth',
            latencyMs: Date.now() - start,
          };
          this.onLog(`✓ BT: ${cmd.action} enviado (${result.latencyMs}ms)`, 'success');
          this.commandHistory.push({ cmd, result });
          return result;
        }
      } catch (err) {
        this.onLog(`⚠ BT falhou: ${(err as Error).message}`, 'warning');
      }
    }

    // 2. Try WebSocket
    if (this.wsSendFn) {
      try {
        this.onLog(`🟢 WS → ${cmd.action}`, 'info');
        this.wsSendFn({ type: 'navigate', data: cmd, timestamp: Date.now() });
        const result: CommandResult = {
          success: true,
          channel: 'websocket',
          latencyMs: Date.now() - start,
        };
        this.onLog(`✓ WS: ${cmd.action} enviado (${result.latencyMs}ms)`, 'success');
        this.commandHistory.push({ cmd, result });
        return result;
      } catch (err) {
        this.onLog(`⚠ WS falhou: ${(err as Error).message}`, 'warning');
      }
    }

    // 3. Try HTTP (fallback)
    if (this.httpBaseUrl) {
      try {
        this.onLog(`🟠 HTTP → ${cmd.action}`, 'info');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${this.httpBaseUrl}/api/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const result: CommandResult = {
          success: res.ok,
          channel: 'http',
          response: await res.text().catch(() => ''),
          latencyMs: Date.now() - start,
        };
        this.onLog(`${res.ok ? '✓' : '✗'} HTTP: ${cmd.action} (${result.latencyMs}ms)`, res.ok ? 'success' : 'error');
        this.commandHistory.push({ cmd, result });
        return result;
      } catch (err) {
        this.onLog(`⚠ HTTP falhou: ${(err as Error).message}`, 'warning');
      }
    }

    // No channel available
    const result: CommandResult = { success: false, channel: 'none', error: 'Nenhum canal de comunicação disponível' };
    this.onLog(`✗ ${cmd.action}: sem canal disponível`, 'error');
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
}
