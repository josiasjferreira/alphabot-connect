/**
 * RotationService — Controls robot rotation via HTTP API and monitors orientation.
 * Robot: CT300-H330-1029-01 | HTTP port 80
 */

export interface RotationCommand {
  direction: 'left' | 'right' | 'stop';
  speed: number;
  angle?: number;
  duration?: number;
}

export interface RobotOrientation {
  angle: number;
  timestamp: number;
  accuracy: number;
}

type OrientationCallback = (orientation: RobotOrientation) => void;

export class RotationService {
  private robotIP: string;
  private httpPort: number;
  private _currentAngle = 0;
  private _rotating = false;
  private onOrientationCb?: OrientationCallback;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(robotIP = '192.168.99.1', httpPort = 80) {
    this.robotIP = robotIP;
    this.httpPort = httpPort;
  }

  setRobotIP(ip: string, port = 80) {
    this.robotIP = ip;
    this.httpPort = port;
  }

  private get baseURL() {
    return `http://${this.robotIP}:${this.httpPort}/api`;
  }

  async rotateLeft(speed = 50, duration?: number): Promise<boolean> {
    return this.sendRotation({ direction: 'left', speed, duration });
  }

  async rotateRight(speed = 50, duration?: number): Promise<boolean> {
    return this.sendRotation({ direction: 'right', speed, duration });
  }

  async rotateToAngle(targetAngle: number, speed = 50): Promise<boolean> {
    targetAngle = ((targetAngle % 360) + 360) % 360;
    let diff = targetAngle - this._currentAngle;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;

    const direction = diff > 0 ? 'right' : 'left';
    const duration = Math.abs(diff) * 10;

    return this.sendRotation({ direction, speed, angle: targetAngle, duration });
  }

  async stop(): Promise<boolean> {
    return this.sendRotation({ direction: 'stop', speed: 0 });
  }

  private async sendRotation(cmd: RotationCommand): Promise<boolean> {
    this._rotating = cmd.direction !== 'stop';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.baseURL}/robot/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction: cmd.direction,
          speed: Math.max(0, Math.min(100, cmd.speed)),
          angle: cmd.angle,
          duration: cmd.duration,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (cmd.duration && cmd.direction !== 'stop') {
        await new Promise(r => setTimeout(r, cmd.duration));
        this._rotating = false;
      }

      return res.ok;
    } catch (err) {
      console.error('[RotationService] Erro:', err);
      this._rotating = false;
      return false;
    }
  }

  async getOrientation(): Promise<RobotOrientation> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${this.baseURL}/robot/orientation`, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const orientation: RobotOrientation = {
          angle: data.angle ?? this._currentAngle,
          timestamp: data.timestamp ?? Date.now(),
          accuracy: data.accuracy ?? 95,
        };
        this._currentAngle = orientation.angle;
        this.onOrientationCb?.(orientation);
        return orientation;
      }
    } catch {
      // offline or unreachable
    }
    return { angle: this._currentAngle, timestamp: Date.now(), accuracy: 0 };
  }

  startOrientationPolling(intervalMs = 500) {
    this.stopOrientationPolling();
    this.pollInterval = setInterval(() => this.getOrientation(), intervalMs);
  }

  stopOrientationPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  onOrientationChange(cb: OrientationCallback) { this.onOrientationCb = cb; }
  isRotating() { return this._rotating; }
  getCurrentAngle() { return this._currentAngle; }

  /** Update angle from external sources (BT telemetry, simulation) */
  setAngleFromExternal(angle: number) {
    this._currentAngle = ((angle % 360) + 360) % 360;
    this.onOrientationCb?.({ angle: this._currentAngle, timestamp: Date.now(), accuracy: 100 });
  }

  destroy() {
    this.stopOrientationPolling();
  }
}

export const rotationService = new RotationService();
