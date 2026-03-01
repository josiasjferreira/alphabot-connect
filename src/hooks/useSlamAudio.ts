/**
 * useSlamAudio.ts
 * Ponte SLAMWARE REST + Áudio MQTT para AlphaBot Connect v3.1.7
 *
 * SLAMWARE REST API: http://192.168.99.2:1445
 * MQTT Broker WS:   ws://192.168.99.100:9002
 * Polling interval:  3 s
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import mqtt, { type MqttClient } from 'mqtt';
import type { NavTarget, SlamConnectionStatus, SlamPose } from '@/shared-core/types/slam';

// ─── Constantes de rede ─────────────────────────────────────────────
const SLAM_BASE = 'http://192.168.99.2:1445';
const MQTT_WS = 'ws://192.168.99.100:9002';
const POLL_INTERVAL = 3_000;

const TOPIC_TTS = 'alphabot/cmd/audio/tts';
const TOPIC_VOLUME = 'alphabot/cmd/audio/volume';
const TOPIC_STOP = 'alphabot/cmd/audio/stop';
const TOPIC_STATUS = 'alphabot/status/audio';

// ─── Mapeamento de eventos SLAMWARE → fala pt-BR ────────────────────
const EVENT_PHRASES: Record<string, string> = {
  power_low: 'Atenção! Bateria baixa, por favor me leve ao carregador.',
  bumper_triggered: 'Obstáculo detectado à frente, parando.',
  cliff_triggered: 'Degrau detectado, parando por segurança.',
  arrived_at_target: 'Cheguei ao destino.',
  start_charging: 'Conectado ao carregador. Recarregando.',
};

// ─── Helpers ────────────────────────────────────────────────────────
const VOLUME_KEY = 'alphabot-slam-audio-volume';
function loadVolume(): number {
  try { return Number(localStorage.getItem(VOLUME_KEY)) || 70; } catch { return 70; }
}

export interface SlamAudioState {
  slamStatus: SlamConnectionStatus;
  pose: SlamPose;
  isNavigating: boolean;
  isMqttOnline: boolean;
  isPlaying: boolean;
  volume: number;
  lastAnnouncement: string;
}

export function useSlamAudio() {
  // ── State ──
  const [slamStatus, setSlamStatus] = useState<SlamConnectionStatus>('disconnected');
  const [pose, setPose] = useState<SlamPose>({ x: 0, y: 0, theta: 0, timestamp: 0, quality: 0 });
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMqttOnline, setIsMqttOnline] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(loadVolume);
  const [lastAnnouncement, setLastAnnouncement] = useState('');

  // ── Refs ──
  const mqttRef = useRef<MqttClient | null>(null);
  const poseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentActionRef = useRef<string | null>(null);
  const navTargetRef = useRef<NavTarget | null>(null);

  // ────────────────────────────────────────────────────────────────────
  // MQTT lifecycle
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const client = mqtt.connect(MQTT_WS, {
      reconnectPeriod: 3000,
      connectTimeout: 5000,
    });

    client.on('connect', () => {
      setIsMqttOnline(true);
      client.subscribe(TOPIC_STATUS);
    });
    client.on('offline', () => setIsMqttOnline(false));
    client.on('close', () => setIsMqttOnline(false));
    client.on('error', () => setIsMqttOnline(false));

    client.on('message', (_topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (typeof data.playing === 'boolean') setIsPlaying(data.playing);
      } catch { /* ignore */ }
    });

    mqttRef.current = client;
    return () => { client.end(true); mqttRef.current = null; };
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // MQTT publish helpers
  // ────────────────────────────────────────────────────────────────────
  const mqttPublish = useCallback((topic: string, payload: object) => {
    mqttRef.current?.publish(topic, JSON.stringify(payload));
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // speak — MQTT TTS com fallback Web Speech
  // ────────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    setLastAnnouncement(text);
    console.log(`🗺️🔊 [SlamAudio] ${text}`);

    if (mqttRef.current?.connected) {
      mqttPublish(TOPIC_TTS, { text, lang: 'pt-BR', type: 'tts' });
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'pt-BR';
      utt.volume = volume / 100;
      utt.onstart = () => setIsPlaying(true);
      utt.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utt);
    }
  }, [mqttPublish, volume]);

  const stopAudio = useCallback(() => {
    if (mqttRef.current?.connected) {
      mqttPublish(TOPIC_STOP, { timestamp: Date.now() });
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [mqttPublish]);

  const setVolume = useCallback((n: number) => {
    setVolumeState(n);
    try { localStorage.setItem(VOLUME_KEY, String(n)); } catch { /* */ }
    if (mqttRef.current?.connected) {
      mqttPublish(TOPIC_VOLUME, { level: n });
    }
  }, [mqttPublish]);

  // ────────────────────────────────────────────────────────────────────
  // SLAMWARE REST — polling pose
  // ────────────────────────────────────────────────────────────────────
  const fetchPose = useCallback(async () => {
    try {
      const res = await fetch(`${SLAM_BASE}/api/core/system/v1/robot/info`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const newPose: SlamPose = {
        x: data.x ?? data.pose?.x ?? 0,
        y: data.y ?? data.pose?.y ?? 0,
        theta: data.theta ?? data.pose?.yaw ?? 0,
        quality: data.localization_quality ?? data.quality ?? 0,
        timestamp: Date.now(),
      };
      setPose(newPose);

      // Verificar chegada ao destino
      const target = navTargetRef.current;
      if (target && isNavigating) {
        const dist = Math.sqrt((newPose.x - target.x) ** 2 + (newPose.y - target.y) ** 2);
        if (dist < 0.3) {
          speak(`Cheguei ao destino: ${target.label || `${target.x.toFixed(1)}, ${target.y.toFixed(1)}`}.`);
          setIsNavigating(false);
          navTargetRef.current = null;
          currentActionRef.current = null;
        }
      }
    } catch {
      // silently fail — status already set on connect/disconnect
    }
  }, [isNavigating, speak]);

  // ────────────────────────────────────────────────────────────────────
  // SLAMWARE REST — polling events
  // ────────────────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${SLAM_BASE}/api/platform/v1/events`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return;
      const data = await res.json();
      const events: Array<{ type?: string; event_type?: string }> = Array.isArray(data) ? data : data.events ?? [];
      for (const evt of events) {
        const key = evt.type ?? evt.event_type ?? '';
        const phrase = EVENT_PHRASES[key];
        if (phrase) speak(phrase);
        if (key === 'arrived_at_target') {
          setIsNavigating(false);
          navTargetRef.current = null;
          currentActionRef.current = null;
        }
      }
    } catch { /* */ }
  }, [speak]);

  // ────────────────────────────────────────────────────────────────────
  // connectSlam / disconnectSlam
  // ────────────────────────────────────────────────────────────────────
  const connectSlam = useCallback(async () => {
    setSlamStatus('connecting');
    try {
      const res = await fetch(`${SLAM_BASE}/api/core/system/v1/robot/info`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(String(res.status));
      setSlamStatus('connected');
      speak('SLAMWARE conectado. Navegação disponível.');

      // Start polling
      poseTimerRef.current = setInterval(fetchPose, POLL_INTERVAL);
      eventsTimerRef.current = setInterval(fetchEvents, POLL_INTERVAL);
      fetchPose();
      return true;
    } catch {
      setSlamStatus('error');
      speak('Erro na conexão com SLAMWARE.');
      return false;
    }
  }, [fetchPose, fetchEvents, speak]);

  const stopPolling = useCallback(() => {
    if (poseTimerRef.current) { clearInterval(poseTimerRef.current); poseTimerRef.current = null; }
    if (eventsTimerRef.current) { clearInterval(eventsTimerRef.current); eventsTimerRef.current = null; }
  }, []);

  const disconnectSlam = useCallback(() => {
    stopPolling();
    setSlamStatus('disconnected');
    setIsNavigating(false);
    navTargetRef.current = null;
    currentActionRef.current = null;
  }, [stopPolling]);

  // cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  // ────────────────────────────────────────────────────────────────────
  // navigateTo / cancelNav
  // ────────────────────────────────────────────────────────────────────
  const navigateTo = useCallback(async (target: NavTarget) => {
    if (slamStatus !== 'connected') {
      speak('SLAMWARE não conectado. Não é possível navegar.');
      return false;
    }

    const label = target.label || `${target.x.toFixed(1)}, ${target.y.toFixed(1)}`;
    speak(`Navegando para ${label}.`);
    navTargetRef.current = target;
    setIsNavigating(true);

    try {
      const res = await fetch(`${SLAM_BASE}/api/core/motion/v1/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_name: 'slamware.agent.actions.MoveToAction',
          target_pose: { x: target.x, y: target.y, theta: 0 },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      currentActionRef.current = data.action_id ?? data.id ?? null;
      return true;
    } catch {
      speak('Falha ao iniciar navegação.');
      setIsNavigating(false);
      navTargetRef.current = null;
      return false;
    }
  }, [slamStatus, speak]);

  const cancelNav = useCallback(async () => {
    const actionId = currentActionRef.current;
    if (actionId) {
      try {
        await fetch(`${SLAM_BASE}/api/core/motion/v1/actions/${actionId}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(3000),
        });
      } catch { /* */ }
    }
    setIsNavigating(false);
    navTargetRef.current = null;
    currentActionRef.current = null;
    speak('Navegação cancelada.');
  }, [speak]);

  // ────────────────────────────────────────────────────────────────────
  // announcePosition
  // ────────────────────────────────────────────────────────────────────
  const announcePosition = useCallback(() => {
    speak(`Posição atual: ${pose.x.toFixed(1)} metros, ${pose.y.toFixed(1)} metros. Qualidade: ${pose.quality}%.`);
  }, [pose, speak]);

  // ────────────────────────────────────────────────────────────────────
  return {
    slamStatus,
    pose,
    isNavigating,
    isMqttOnline,
    isPlaying,
    volume,
    lastAnnouncement,
    connectSlam,
    disconnectSlam,
    navigateTo,
    cancelNav,
    announcePosition,
    speak,
    stopAudio,
    setVolume,
  };
}
