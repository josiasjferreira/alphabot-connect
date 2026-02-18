export interface VideoFrame {
  timestamp: number;
  data: Blob;
  format: 'mjpeg' | 'h264' | 'raw';
}

type FrameCallback = (frame: VideoFrame) => void;
type StatusCallback = () => void;

export class VideoStreamService {
  private ws: WebSocket | null = null;
  private robotIP: string;
  private wsPort: number;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onFrameCallback?: FrameCallback;
  private onConnectCallback?: StatusCallback;
  private onDisconnectCallback?: StatusCallback;
  private _connected = false;

  constructor(robotIP = '192.168.99.1', wsPort = 8080) {
    this.robotIP = robotIP;
    this.wsPort = wsPort;
  }

  setRobotIP(ip: string, port = 8080) {
    this.robotIP = ip;
    this.wsPort = port;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `ws://${this.robotIP}:${this.wsPort}/video`;
        console.log('[VideoStream] Connecting to', url);
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('[VideoStream] Connected');
          this._connected = true;
          this.reconnectAttempts = 0;
          this.onConnectCallback?.();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (err) => {
          console.error('[VideoStream] Error:', err);
          if (!this._connected) reject(err);
        };

        this.ws.onclose = () => {
          console.log('[VideoStream] Disconnected');
          this._connected = false;
          this.ws = null;
          this.onDisconnectCallback?.();
          this.attemptReconnect();
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(data: ArrayBuffer | string) {
    if (!this.onFrameCallback) return;

    if (data instanceof ArrayBuffer) {
      this.onFrameCallback({
        timestamp: Date.now(),
        data: new Blob([data], { type: 'image/jpeg' }),
        format: 'mjpeg',
      });
    } else if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        const src = parsed.frame || parsed.image || parsed.data;
        if (src) {
          const base64 = src.startsWith('data:') ? src : `data:image/jpeg;base64,${src}`;
          fetch(base64).then(r => r.blob()).then(blob => {
            this.onFrameCallback?.({
              timestamp: Date.now(),
              data: blob,
              format: 'mjpeg',
            });
          });
        }
      } catch { /* not JSON */ }
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[VideoStream] Max reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`[VideoStream] Reconnecting in ${Math.round(delay)}ms (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  resetReconnect() {
    this.reconnectAttempts = 0;
  }

  onFrame(cb: FrameCallback) { this.onFrameCallback = cb; }
  onConnect(cb: StatusCallback) { this.onConnectCallback = cb; }
  onDisconnect(cb: StatusCallback) { this.onDisconnectCallback = cb; }
  isConnected() { return this._connected; }
}
