/**
 * src/services/audioService.ts
 * Singleton de áudio centralizado — AlphaBot Connect v3.1.7
 *
 * MQTT TTS: ws://192.168.99.100:9002
 * SLAMWARE events: http://192.168.99.2:1445/api/platform/v1/events
 *
 * Combina o serviço legado (playRobotAudio/playUrl) com o novo
 * AudioService singleton (TTS MQTT + Web Speech + event monitor).
 */

import mqtt, { type MqttClient } from 'mqtt';

// ─── Config ─────────────────────────────────────────────────────────
const SLAMWARE_BASE = 'http://192.168.99.2:1445';
const MQTT_WS = 'ws://192.168.99.100:9002';
const TOPIC_TTS = 'alphabot/cmd/audio/tts';
const TOPIC_VOLUME = 'alphabot/cmd/audio/volume';
const TOPIC_STOP = 'alphabot/cmd/audio/stop';
const TOPIC_STATUS = 'alphabot/status/audio';
const VOLUME_KEY = 'robot_volume';
const MAX_HISTORY = 20;
const EVENT_POLL_MS = 3_000;

// ─── Event → Speech mapping ────────────────────────────────────────
const CRITICAL_EVENTS: Record<string, string> = {
  power_low: 'Atenção! Bateria baixa, por favor me leve ao carregador.',
  bumper_triggered: 'Obstáculo detectado à frente, parando.',
  bumper: 'Senti um impacto, verificando obstáculo.',
  cliff_triggered: 'Degrau detectado, parando por segurança.',
  cliff: 'Detectei um degrau, parando por segurança.',
  arrived_at_target: 'Cheguei ao destino.',
  arrived: 'Entrega concluída. Obrigado!',
  pickup_done: 'Item coletado, seguindo para entrega.',
  start_charging: 'Conectado ao carregador. Recarregando.',
  charging: 'Conectado ao carregador. Recarregando.',
};

// ─── Types ──────────────────────────────────────────────────────────
export type RobotSoundType = 'greeting' | 'alert' | 'error' | 'success' | 'navigation' | 'delivery';

export interface SpeechEntry {
  text: string;
  timestamp: number;
  source: 'mqtt' | 'webspeech';
}

export type AudioServiceListener = (state: {
  mqttOnline: boolean;
  isPlaying: boolean;
  volume: number;
  lastAnnouncement: string;
}) => void;

// ─── Singleton ──────────────────────────────────────────────────────
class AudioServiceImpl {
  private static _instance: AudioServiceImpl | null = null;

  // MQTT
  private mqttClient: MqttClient | null = null;
  private _mqttOnline = false;

  // Legacy audio element
  private audioElement: HTMLAudioElement;
  private robotIP = '192.168.99.10';
  private httpPort = 80;

  // State
  private _isPlaying = false;
  private _volume: number;
  private _lastAnnouncement = '';
  private _history: SpeechEntry[] = [];
  private _listeners = new Set<AudioServiceListener>();
  private eventTimer: ReturnType<typeof setInterval> | null = null;
  private _onPlayCb?: () => void;
  private _onStopCb?: () => void;

  constructor(robotIP?: string, httpPort?: number) {
    if (robotIP) this.robotIP = robotIP;
    if (httpPort) this.httpPort = httpPort;
    this._volume = this.loadVolume();
    this.audioElement = new Audio();
    this.audioElement.addEventListener('play', () => { this._isPlaying = true; this._onPlayCb?.(); this.notify(); });
    this.audioElement.addEventListener('ended', () => { this._isPlaying = false; this._onStopCb?.(); this.notify(); });
    this.audioElement.addEventListener('error', () => { this._isPlaying = false; this._onStopCb?.(); this.notify(); });
    // Only init MQTT for singleton
    if (!AudioServiceImpl._instance) {
      this.initMqtt();
    }
  }

  static getInstance(): AudioServiceImpl {
    if (!AudioServiceImpl._instance) {
      AudioServiceImpl._instance = new AudioServiceImpl();
    }
    return AudioServiceImpl._instance;
  }

  // ── MQTT ──────────────────────────────────────────────────────────
  private initMqtt() {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      console.warn('[AudioService] HTTPS detected — MQTT disabled (mixed content).');
      return;
    }
    try {
      const c = mqtt.connect(MQTT_WS, { reconnectPeriod: 3000, connectTimeout: 5000 });
      c.on('connect', () => { this._mqttOnline = true; c.subscribe(TOPIC_STATUS); this.notify(); });
      c.on('offline', () => { this._mqttOnline = false; this.notify(); });
      c.on('close', () => { this._mqttOnline = false; this.notify(); });
      c.on('error', () => { this._mqttOnline = false; this.notify(); });
      c.on('message', (_topic, payload) => {
        try {
          const d = JSON.parse(payload.toString());
          if (typeof d.playing === 'boolean') { this._isPlaying = d.playing; this.notify(); }
        } catch { /* ignore */ }
      });
      this.mqttClient = c;
    } catch {
      console.warn('[AudioService] MQTT connect failed.');
    }
  }

  // ── Notify ────────────────────────────────────────────────────────
  private notify() {
    const state = { mqttOnline: this._mqttOnline, isPlaying: this._isPlaying, volume: this._volume, lastAnnouncement: this._lastAnnouncement };
    this._listeners.forEach(fn => fn(state));
  }

  subscribe(fn: AudioServiceListener): () => void {
    this._listeners.add(fn);
    fn({ mqttOnline: this._mqttOnline, isPlaying: this._isPlaying, volume: this._volume, lastAnnouncement: this._lastAnnouncement });
    return () => { this._listeners.delete(fn); };
  }

  // ── TTS (MQTT + Web Speech fallback) ──────────────────────────────
  async speak(text: string, lang = 'pt-BR'): Promise<void> {
    this._lastAnnouncement = text;
    console.log(`🔊 [AudioService] ${text}`);
    let source: 'mqtt' | 'webspeech' = 'webspeech';

    if (this.mqttClient?.connected) {
      this.mqttClient.publish(TOPIC_TTS, JSON.stringify({ text, lang, type: 'tts' }));
      source = 'mqtt';
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      utt.volume = this._volume / 100;
      utt.onstart = () => { this._isPlaying = true; this.notify(); };
      utt.onend = () => { this._isPlaying = false; this.notify(); };
      window.speechSynthesis.speak(utt);
    }

    this._history.unshift({ text, timestamp: Date.now(), source });
    if (this._history.length > MAX_HISTORY) this._history.length = MAX_HISTORY;
    this.notify();
  }

  setVolume(level: number): void {
    this._volume = Math.max(0, Math.min(100, level));
    this.audioElement.volume = this._volume / 100;
    try { localStorage.setItem(VOLUME_KEY, String(this._volume)); } catch { /* */ }
    if (this.mqttClient?.connected) {
      this.mqttClient.publish(TOPIC_VOLUME, JSON.stringify({ level: this._volume }));
    }
    this.notify();
  }

  stop(): void {
    if (this.mqttClient?.connected) {
      this.mqttClient.publish(TOPIC_STOP, JSON.stringify({ timestamp: Date.now() }));
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this._isPlaying = false;
    this.notify();
  }

  getHistory(): SpeechEntry[] { return [...this._history]; }
  isMqttOnline(): boolean { return this._mqttOnline; }
  get volume(): number { return this._volume; }
  get isPlaying(): boolean { return this._isPlaying; }
  get lastAnnouncement(): string { return this._lastAnnouncement; }

  // ── Legacy audio methods (backward compat) ────────────────────────
  setRobotIP(ip: string, port = 80) { this.robotIP = ip; this.httpPort = port; }
  onPlay(cb: () => void) { this._onPlayCb = cb; }
  onStop(cb: () => void) { this._onStopCb = cb; }

  async playRobotAudio(type: RobotSoundType): Promise<boolean> {
    try {
      this.audioElement.src = `http://${this.robotIP}:${this.httpPort}/api/audio/${type}`;
      this.audioElement.volume = this._volume / 100;
      await this.audioElement.play();
      this._isPlaying = true; this.notify();
      return true;
    } catch (err) { console.error('[AudioService] Play failed:', err); return false; }
  }

  async playUrl(url: string): Promise<boolean> {
    try {
      this.audioElement.src = url;
      this.audioElement.volume = this._volume / 100;
      await this.audioElement.play();
      this._isPlaying = true; this.notify();
      return true;
    } catch (err) { console.error('[AudioService] Play URL failed:', err); return false; }
  }

  // ── SLAMWARE Event Monitor ────────────────────────────────────────
  startEventMonitor(): void {
    if (this.eventTimer) return;
    this.pollEvents();
    this.eventTimer = setInterval(() => this.pollEvents(), EVENT_POLL_MS);
    console.log('[AudioService] Event monitor started');
  }

  stopEventMonitor(): void {
    if (this.eventTimer) { clearInterval(this.eventTimer); this.eventTimer = null; }
    console.log('[AudioService] Event monitor stopped');
  }

  private async pollEvents() {
    try {
      const res = await fetch(`${SLAMWARE_BASE}/api/platform/v1/events`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return;
      const data = await res.json();
      const list: Array<{ type?: string; event_type?: string; [k: string]: unknown }> =
        Array.isArray(data) ? data : data.events ?? [];
      for (const evt of list) {
        const key = evt.type ?? evt.event_type ?? '';
        const phrase = CRITICAL_EVENTS[key];
        if (phrase) this.speak(phrase);
        window.dispatchEvent(new CustomEvent('slamware-event', { detail: evt }));
      }
    } catch { /* SLAM offline */ }
  }

  private loadVolume(): number {
    try { return Number(localStorage.getItem(VOLUME_KEY)) || 70; } catch { return 70; }
  }
}

// ─── Exports ────────────────────────────────────────────────────────
export const audioService = AudioServiceImpl.getInstance();
export { AudioServiceImpl as AudioService };
