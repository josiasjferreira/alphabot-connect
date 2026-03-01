/**
 * useSlamAudio.ts
 * Ponte SLAMWARE REST + Áudio via AudioService singleton
 *
 * SLAMWARE REST API: http://192.168.99.2:1445
 * Áudio: delegado ao AudioService (MQTT + Web Speech fallback)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { audioService } from '@/services/audioService';
import type { NavTarget, SlamConnectionStatus, SlamPose } from '@/shared-core/types/slam';

const SLAM_BASE = 'http://192.168.99.2:1445';
const POLL_INTERVAL = 3_000;

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
  const [slamStatus, setSlamStatus] = useState<SlamConnectionStatus>('disconnected');
  const [pose, setPose] = useState<SlamPose>({ x: 0, y: 0, theta: 0, timestamp: 0, quality: 0 });
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMqttOnline, setIsMqttOnline] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(audioService.volume);
  const [lastAnnouncement, setLastAnnouncement] = useState('');

  const poseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentActionRef = useRef<string | null>(null);
  const navTargetRef = useRef<NavTarget | null>(null);

  // Subscribe to AudioService state
  useEffect(() => {
    return audioService.subscribe((state) => {
      setIsMqttOnline(state.mqttOnline);
      setIsPlaying(state.isPlaying);
      setVolumeState(state.volume);
      setLastAnnouncement(state.lastAnnouncement);
    });
  }, []);

  // ── speak via AudioService ──
  const speak = useCallback((text: string) => {
    audioService.speak(text);
  }, []);

  const stopAudio = useCallback(() => {
    audioService.stop();
  }, []);

  const setVolume = useCallback((n: number) => {
    audioService.setVolume(n);
  }, []);

  // ── SLAMWARE REST — polling pose ──
  const fetchPose = useCallback(async () => {
    try {
      const res = await fetch(`${SLAM_BASE}/api/core/system/v1/robot/info`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const loc = data.localization ?? data;
      setPose({
        x: loc.x ?? 0,
        y: loc.y ?? 0,
        theta: loc.theta ?? loc.yaw ?? 0,
        quality: loc.quality ?? 0,
        timestamp: Date.now(),
      });
    } catch { /* silently fail */ }
  }, []);

  // ── polling action status ──
  const fetchActionStatus = useCallback(async () => {
    if (!currentActionRef.current || !navTargetRef.current) return;
    try {
      const res = await fetch(`${SLAM_BASE}/api/core/motion/v1/actions/current`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return;
      const data = await res.json();
      const status = (data.status ?? data.state ?? '').toLowerCase();
      if (status === 'finished' || status === 'stopped') {
        const label = navTargetRef.current?.label ?? 'programado';
        speak(`Cheguei ao destino ${label}.`);
        setIsNavigating(false);
        navTargetRef.current = null;
        currentActionRef.current = null;
      }
    } catch { /* */ }
  }, [speak]);

  // ── connectSlam / disconnectSlam ──
  const connectSlam = useCallback(async () => {
    setSlamStatus('connecting');
    try {
      const res = await fetch(`${SLAM_BASE}/api/core/system/v1/robot/info`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(String(res.status));
      setSlamStatus('connected');
      speak('SLAMWARE conectado. Navegação disponível.');

      // Start polling (pose + action status) + event monitor via AudioService
      poseTimerRef.current = setInterval(() => { fetchPose(); fetchActionStatus(); }, POLL_INTERVAL);
      audioService.startEventMonitor();
      fetchPose();
      return true;
    } catch {
      setSlamStatus('error');
      speak('Erro na conexão com SLAMWARE.');
      return false;
    }
  }, [fetchPose, fetchActionStatus, speak]);

  const stopPolling = useCallback(() => {
    if (poseTimerRef.current) { clearInterval(poseTimerRef.current); poseTimerRef.current = null; }
    audioService.stopEventMonitor();
  }, []);

  const disconnectSlam = useCallback(() => {
    stopPolling();
    setSlamStatus('disconnected');
    setIsNavigating(false);
    navTargetRef.current = null;
    currentActionRef.current = null;
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── navigateTo / cancelNav ──
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
          action_name: 'slamtec.agent.actions.MoveToAction',
          options: {
            target_pose: { x: target.x, y: target.y, theta: 0 },
            move_options: { mode: 0, flags: [] },
          },
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
    try {
      await fetch(`${SLAM_BASE}/api/core/motion/v1/actions/current`, { method: 'DELETE', signal: AbortSignal.timeout(3000) });
    } catch { /* */ }
    setIsNavigating(false);
    navTargetRef.current = null;
    currentActionRef.current = null;
    speak('Navegação cancelada.');
  }, [speak]);

  const announcePosition = useCallback(() => {
    speak(`Posição atual: ${pose.x.toFixed(1)} metros, ${pose.y.toFixed(1)} metros. Qualidade: ${pose.quality}%.`);
  }, [pose, speak]);

  return {
    slamStatus, pose, isNavigating, isMqttOnline, isPlaying, volume, lastAnnouncement,
    connectSlam, disconnectSlam, navigateTo, cancelNav, announcePosition,
    speak, stopAudio, setVolume,
  };
}
