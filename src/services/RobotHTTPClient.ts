/**
 * @file RobotHTTPClient.ts
 * @brief Cliente HTTP REST para comunicação local WiFi com robô CSJBot
 * @version 1.0.0
 */

import type { CalibrationProgress, CalibrationData, CalibrationState } from '@/services/bluetoothCalibrationBridge';

const DEFAULT_TIMEOUT = 10_000;

export interface RobotHTTPClientOptions {
  ip: string;
  onProgressUpdate?: (p: CalibrationProgress) => void;
  onComplete?: (d: CalibrationData) => void;
  onError?: (msg: string) => void;
  onDisconnected?: () => void;
  onLog?: (msg: string) => void;
}

export interface SensorReading {
  [key: string]: unknown;
}

export interface MovementParams {
  speed?: number;
  distance?: number;
  angle?: number;
  x?: number;
  y?: number;
}

/**
 * Cliente HTTP REST para robô CSJBot via WiFi local
 */
export class RobotHTTPClient {
  private ip: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private pollingId: ReturnType<typeof setInterval> | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private _connected = false;

  public onProgressUpdate: RobotHTTPClientOptions['onProgressUpdate'];
  public onComplete: RobotHTTPClientOptions['onComplete'];
  public onError: RobotHTTPClientOptions['onError'];
  public onDisconnected: RobotHTTPClientOptions['onDisconnected'];
  public onLog: RobotHTTPClientOptions['onLog'];

  constructor(opts: RobotHTTPClientOptions) {
    // IP sem porta — o detectRobotIP() agora retorna IPs sem porta (ex: '192.168.0.1')
    // Testes manuais confirmaram que http://192.168.0.1/api/ping funciona sem :80 explícito
    const rawIp = opts.ip ?? '192.168.0.1';
    // Extrair só o host (sem porta) para construir as URLs
    const host = rawIp.includes(':') ? rawIp.split(':')[0] : rawIp;
    this.ip = host; // guardar sem porta
    this.wsUrl = `ws://${host}:8080`;
    this.onProgressUpdate = opts.onProgressUpdate;
    this.onComplete = opts.onComplete;
    this.onError = opts.onError;
    this.onDisconnected = opts.onDisconnected;
    this.onLog = opts.onLog;
    this._connected = true;
    console.log('🎯 RobotHTTPClient inicializado:', { http: `http://${this.ip}`, websocket: this.wsUrl });
    this.startHeartbeat();
  }

  /**
   * Detecta o robô testando IPs em ordem (192.168.0.1 primeiro — confirmado)
   */
  static async detectRobotIP(): Promise<string | null> {
    console.log('🔍 Detectando robô via port forwarding...');

    const CANDIDATE_IPS = ['192.168.0.1', '192.168.99.101', '192.168.99.1'];

    for (const ip of CANDIDATE_IPS) {
      console.log(`🎯 Testando: http://${ip}/api/ping`);
      try {
        const startTime = Date.now();
        const response = await fetch(`http://${ip}/api/ping`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000),
          cache: 'no-store',
        });
        const responseTime = Date.now() - startTime;
        console.log(`📊 Resposta de ${ip}: status=${response.status}, tempo=${responseTime}ms`);

        if (response.ok) {
          try {
            const data = await response.json();
            console.log(`✅ ROBÔ ENCONTRADO em ${ip}!`, data);
          } catch {
            console.log(`✅ ROBÔ ENCONTRADO em ${ip} (resposta não-JSON)`);
          }
          return ip;
        }
      } catch (error: any) {
        console.error(`❌ Erro ao testar ${ip}:`, error.message);
      }
    }

    console.error('❌ Nenhum robô encontrado em nenhum IP testado.');
    return null;
  }

  /**
   * Conecta WebSocket para atualizações em tempo real
   */
  connectWebSocket(callbacks: {
    onMessage?: (data: unknown) => void;
    onError?: (error: Event) => void;
    onClose?: () => void;
    onOpen?: () => void;
  } = {}) {
    console.log('🔌 Conectando WebSocket:', this.wsUrl);
    this.disconnectWebSocket();

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket conectado!');
        callbacks.onOpen?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 Mensagem WebSocket recebida:', data);
          callbacks.onMessage?.(data);
        } catch {
          callbacks.onMessage?.(event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Erro no WebSocket:', error);
        callbacks.onError?.(error);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket desconectado');
        this.ws = null;
        callbacks.onClose?.();
      };
    } catch (err: any) {
      console.error('❌ Não foi possível criar WebSocket:', err.message);
    }
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendWebSocket(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  get wsConnected() { return this.ws?.readyState === WebSocket.OPEN; }

  get connected() { return this._connected; }
  get baseUrl() { return `http://${this.ip}`; } // sem porta — usa 80 padrão HTTP

  // ───── Generic request ─────

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const url = `${this.baseUrl}${path}`;

    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        if (res.status === 404) throw new Error('Endpoint não encontrado (firmware desatualizado?)');
        if (res.status >= 500) throw new Error(`Erro interno do robô (${res.status}): ${errText}`);
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const text = await res.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Robô não respondeu em 10 segundos');
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'))
        throw new Error('Verifique conexão WiFi com robô');
      throw err;
    }
  }

  private log(msg: string) {
    this.onLog?.(`[HTTP] ${msg}`);
  }

  // ───── Heartbeat ─────

  private startHeartbeat() {
    this.heartbeatId = setInterval(async () => {
      try {
        await this.request('GET', '/api/ping', undefined, 3000);
        if (!this._connected) {
          this._connected = true;
          this.log('Reconectado');
        }
      } catch {
        if (this._connected) {
          this._connected = false;
          this.log('Conexão perdida');
          this.onDisconnected?.();
        }
      }
    }, 5000);
  }

  // ───── Calibration ─────

  async startCalibration(sensors?: string[]): Promise<void> {
    this.log('Iniciando calibração...');
    await this.request('POST', '/api/calibration/request', { sensors: sensors ?? ['all'] });
    this.startPolling();
  }

  async stopCalibration(): Promise<void> {
    this.log('Parando calibração...');
    this.stopPolling();
    await this.request('POST', '/api/calibration/stop');
  }

  async resetCalibration(): Promise<void> {
    this.log('Resetando calibração...');
    await this.request('POST', '/api/calibration/reset');
  }

  async getCalibrationProgress(): Promise<CalibrationProgress> {
    return this.request<CalibrationProgress>('GET', '/api/calibration/progress');
  }

  async getCalibrationData(): Promise<CalibrationData> {
    return this.request<CalibrationData>('GET', '/api/calibration/data');
  }

  async getCalibrationState(): Promise<CalibrationState> {
    return this.request<CalibrationState>('GET', '/api/calibration/state');
  }

  async exportCalibration(): Promise<CalibrationData> {
    this.log('Exportando calibração...');
    return this.request<CalibrationData>('POST', '/api/calibration/export');
  }

  async importCalibration(data: CalibrationData): Promise<void> {
    this.log('Importando calibração...');
    await this.request('POST', '/api/calibration/import', data);
  }

  // ───── Polling ─────

  private startPolling() {
    this.stopPolling();
    this.pollingId = setInterval(async () => {
      try {
        const prog = await this.getCalibrationProgress();
        this.onProgressUpdate?.(prog);
        if (prog.progress >= 100) {
          this.stopPolling();
          const data = await this.getCalibrationData();
          this.onComplete?.(data);
        }
      } catch (err: any) {
        this.log(`Polling error: ${err.message}`);
        this.onError?.(err.message);
        this.stopPolling();
      }
    }, 2000);
  }

  private stopPolling() {
    if (this.pollingId) { clearInterval(this.pollingId); this.pollingId = null; }
  }

  // ───── Movement ─────

  async moveForward(params?: MovementParams) { return this.request('POST', '/api/movement/forward', params); }
  async moveBackward(params?: MovementParams) { return this.request('POST', '/api/movement/backward', params); }
  async rotate(params?: MovementParams) { return this.request('POST', '/api/movement/rotate', params); }
  async stopMovement() { return this.request('POST', '/api/movement/stop'); }
  async gotoPosition(params: MovementParams) { return this.request('POST', '/api/movement/goto', params); }
  async getMovementStatus() { return this.request('GET', '/api/movement/status'); }

  // ───── Sensors ─────

  async getSensorData(sensor: 'imu' | 'magnetometer' | 'odometer' | 'lidar' | 'battery' | 'temperature' | 'all') {
    return this.request<SensorReading>('GET', `/api/sensors/${sensor}`);
  }

  // ───── Config / Logs ─────

  async getRobotConfig(sn: string) { return this.request('GET', `/api/config/robot/${sn}`); }
  async updateConfig(params: Record<string, unknown>) { return this.request('POST', '/api/config/update', params); }
  async getRecentLogs() { return this.request<{ logs: string[] }>('GET', '/api/logs/recent'); }
  async clearLogs() { return this.request('POST', '/api/logs/clear'); }

  // ───── Cleanup ─────

  destroy() {
    this.stopPolling();
    if (this.heartbeatId) { clearInterval(this.heartbeatId); this.heartbeatId = null; }
    this.disconnectWebSocket();
    this._connected = false;
    this.log('Client destroyed');
  }
}
