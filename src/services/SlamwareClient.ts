/**
 * SlamwareClient — Comunicação com módulo SLAM (192.168.99.2:1445)
 * 
 * Como o browser não suporta TCP raw, usamos HTTP polling + WebSocket proxy.
 * O tablet Android expõe os dados SLAM via HTTP REST e/ou WebSocket.
 */

import type { SlamPose, SlamMapData, NavTarget, NavPath, SlamObstacle, SlamConnectionStatus, SlamConfig } from '@/shared-core/types/slam';
import { NETWORK, PORTS, TIMEOUTS } from '@/shared-core/constants';

const DEFAULT_CONFIG: SlamConfig = {
  ip: NETWORK.SLAM_IP,
  port: PORTS.SLAM_TCP,
  wsProxyPort: PORTS.WEBSOCKET,
};

export class SlamwareClient {
  private config: SlamConfig;
  private ws: WebSocket | null = null;
  private pollId: ReturnType<typeof setInterval> | null = null;
  private _status: SlamConnectionStatus = 'disconnected';
  private _lastPose: SlamPose = { x: 0, y: 0, theta: 0, timestamp: 0, quality: 0 };

  public onPoseUpdate?: (pose: SlamPose) => void;
  public onMapUpdate?: (map: SlamMapData) => void;
  public onStatusChange?: (status: SlamConnectionStatus) => void;
  public onObstacle?: (obstacles: SlamObstacle[]) => void;

  constructor(config?: Partial<SlamConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get status() { return this._status; }
  get lastPose() { return { ...this._lastPose }; }
  get httpBase() { return `http://${this.config.ip}`; }

  private setStatus(s: SlamConnectionStatus) {
    this._status = s;
    this.onStatusChange?.(s);
  }

  // ─── HTTP Polling (fallback quando WS não disponível) ───

  async connect(): Promise<boolean> {
    this.setStatus('connecting');
    // Tentar WebSocket primeiro, fallback para HTTP polling
    const wsOk = await this.tryWebSocket();
    if (wsOk) return true;

    // Fallback: HTTP polling
    const httpOk = await this.testHttp();
    if (httpOk) {
      this.startPolling();
      this.setStatus('connected');
      return true;
    }

    this.setStatus('error');
    return false;
  }

  private async testHttp(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUTS.SLAM_CONNECT);
      const res = await fetch(`${this.httpBase}/api/slam/pose`, {
        signal: ctrl.signal, cache: 'no-store',
      });
      clearTimeout(timer);
      return res.ok;
    } catch { return false; }
  }

  private async tryWebSocket(): Promise<boolean> {
    if (!this.config.wsProxyPort) return false;
    return new Promise((resolve) => {
      const url = `ws://${this.config.ip}:${this.config.wsProxyPort}/slam`;
      try {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => { ws.close(); resolve(false); }, TIMEOUTS.SLAM_CONNECT);

        ws.onopen = () => {
          clearTimeout(timer);
          this.ws = ws;
          this.setStatus('connected');
          resolve(true);
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.pose) { this._lastPose = data.pose; this.onPoseUpdate?.(data.pose); }
            if (data.obstacles) { this.onObstacle?.(data.obstacles); }
          } catch { /* ignore */ }
        };

        ws.onclose = () => { this.ws = null; this.setStatus('disconnected'); };
        ws.onerror = () => { clearTimeout(timer); ws.close(); resolve(false); };
      } catch { resolve(false); }
    });
  }

  private startPolling() {
    this.stopPolling();
    this.pollId = setInterval(async () => {
      try {
        const res = await fetch(`${this.httpBase}/api/slam/pose`, { cache: 'no-store' });
        if (res.ok) {
          const pose: SlamPose = await res.json();
          this._lastPose = pose;
          this.onPoseUpdate?.(pose);
        }
      } catch { /* skip */ }
    }, TIMEOUTS.POSITION_POLL);
  }

  private stopPolling() {
    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
  }

  // ─── Navigation Commands ───

  async goTo(target: NavTarget): Promise<boolean> {
    try {
      const res = await fetch(`${this.httpBase}/api/slam/goto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target),
      });
      return res.ok;
    } catch { return false; }
  }

  async cancelNavigation(): Promise<boolean> {
    try {
      const res = await fetch(`${this.httpBase}/api/slam/cancel`, { method: 'POST' });
      return res.ok;
    } catch { return false; }
  }

  async getCurrentPath(): Promise<NavPath | null> {
    try {
      const res = await fetch(`${this.httpBase}/api/slam/path`, { cache: 'no-store' });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }

  async getMap(): Promise<SlamMapData | null> {
    try {
      const res = await fetch(`${this.httpBase}/api/slam/map`, { cache: 'no-store' });
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }

  disconnect() {
    this.stopPolling();
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}
