export type RobotSoundType = 'greeting' | 'alert' | 'error' | 'success' | 'navigation' | 'delivery';

type StatusCallback = () => void;

export class AudioService {
  private audioElement: HTMLAudioElement;
  private robotIP: string;
  private httpPort: number;
  private _volume = 50;
  private _playing = false;
  private onPlayCb?: StatusCallback;
  private onStopCb?: StatusCallback;

  constructor(robotIP = '192.168.99.102', httpPort = 80) {
    this.robotIP = robotIP;
    this.httpPort = httpPort;
    this.audioElement = new Audio();
    this.audioElement.addEventListener('play', () => {
      this._playing = true;
      this.onPlayCb?.();
    });
    this.audioElement.addEventListener('ended', () => {
      this._playing = false;
      this.onStopCb?.();
    });
    this.audioElement.addEventListener('error', () => {
      this._playing = false;
      this.onStopCb?.();
    });
  }

  setRobotIP(ip: string, port = 80) {
    this.robotIP = ip;
    this.httpPort = port;
  }

  async playRobotAudio(type: RobotSoundType): Promise<boolean> {
    try {
      const url = `http://${this.robotIP}:${this.httpPort}/api/audio/${type}`;
      this.audioElement.src = url;
      this.audioElement.volume = this._volume / 100;
      await this.audioElement.play();
      return true;
    } catch (err) {
      console.error('[AudioService] Play failed:', err);
      return false;
    }
  }

  async playUrl(url: string): Promise<boolean> {
    try {
      this.audioElement.src = url;
      this.audioElement.volume = this._volume / 100;
      await this.audioElement.play();
      return true;
    } catch (err) {
      console.error('[AudioService] Play URL failed:', err);
      return false;
    }
  }

  stop() {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this._playing = false;
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(100, v));
    this.audioElement.volume = this._volume / 100;
  }

  getVolume() { return this._volume; }
  isPlaying() { return this._playing; }

  onPlay(cb: StatusCallback) { this.onPlayCb = cb; }
  onStop(cb: StatusCallback) { this.onStopCb = cb; }
}

export const audioService = new AudioService();
