/**
 * useSlamAudio.ts
 * Ponte entre eventos de navegação SLAMWARE e feedback de áudio do robô.
 *
 * Monitora a posição e status do SLAM via SlamwareClient e anuncia
 * eventos de navegação (partida, chegada, obstáculo) usando o hook
 * useAudioMQTT (MQTT → Placa Android TTS) com fallback Web Speech.
 *
 * Tópicos MQTT de áudio: alphabot/cmd/audio/play, volume, stop
 * SLAM endpoint: http://192.168.99.2/api/slam/*
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SlamwareClient } from '@/services/SlamwareClient';
import { useAudioMQTT } from '@/hooks/useAudioMQTT';
import type { SlamPose, SlamConnectionStatus, NavTarget } from '@/shared-core/types/slam';

export interface SlamAudioState {
  slamStatus: SlamConnectionStatus;
  pose: SlamPose;
  isNavigating: boolean;
  lastAnnouncement: string;
}

const ARRIVAL_THRESHOLD = 0.3; // metros

export function useSlamAudio() {
  const { speak, stop, setVolume, volume, isPlaying, isMqttOnline } = useAudioMQTT();
  const clientRef = useRef<SlamwareClient | null>(null);
  const navTargetRef = useRef<NavTarget | null>(null);

  const [slamStatus, setSlamStatus] = useState<SlamConnectionStatus>('disconnected');
  const [pose, setPose] = useState<SlamPose>({ x: 0, y: 0, theta: 0, timestamp: 0, quality: 0 });
  const [isNavigating, setIsNavigating] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState('');

  const announce = useCallback((text: string) => {
    speak(text);
    setLastAnnouncement(text);
    console.log(`🗺️🔊 [SlamAudio] ${text}`);
  }, [speak]);

  // Initialize SLAM client
  useEffect(() => {
    const client = new SlamwareClient();
    clientRef.current = client;

    client.onStatusChange = (status) => {
      setSlamStatus(status);
      if (status === 'connected') {
        announce('SLAMWARE conectado. Navegação disponível.');
      } else if (status === 'error') {
        announce('Erro na conexão com SLAMWARE.');
      }
    };

    client.onPoseUpdate = (newPose) => {
      setPose(newPose);
      // Check arrival
      const target = navTargetRef.current;
      if (target && isNavigating) {
        const dist = Math.sqrt((newPose.x - target.x) ** 2 + (newPose.y - target.y) ** 2);
        if (dist < ARRIVAL_THRESHOLD) {
          const label = target.label || `posição ${target.x.toFixed(1)}, ${target.y.toFixed(1)}`;
          announce(`Cheguei ao destino: ${label}.`);
          setIsNavigating(false);
          navTargetRef.current = null;
        }
      }
    };

    client.onObstacle = (obstacles) => {
      if (obstacles.length > 0) {
        const dynamic = obstacles.filter(o => o.type === 'dynamic');
        if (dynamic.length > 0) {
          announce(`Atenção: ${dynamic.length} obstáculo${dynamic.length > 1 ? 's' : ''} detectado${dynamic.length > 1 ? 's' : ''}.`);
        }
      }
    };

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectSlam = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return false;
    return client.connect();
  }, []);

  const disconnectSlam = useCallback(() => {
    clientRef.current?.disconnect();
    setIsNavigating(false);
    navTargetRef.current = null;
  }, []);

  const navigateTo = useCallback(async (target: NavTarget) => {
    const client = clientRef.current;
    if (!client || slamStatus !== 'connected') {
      announce('SLAMWARE não conectado. Não é possível navegar.');
      return false;
    }

    navTargetRef.current = target;
    setIsNavigating(true);
    const label = target.label || `${target.x.toFixed(1)}, ${target.y.toFixed(1)}`;
    announce(`Navegando para ${label}.`);

    const ok = await client.goTo(target);
    if (!ok) {
      announce('Falha ao iniciar navegação.');
      setIsNavigating(false);
      navTargetRef.current = null;
    }
    return ok;
  }, [slamStatus, announce]);

  const cancelNav = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    await client.cancelNavigation();
    setIsNavigating(false);
    navTargetRef.current = null;
    announce('Navegação cancelada.');
  }, [announce]);

  const announcePosition = useCallback(() => {
    const { x, y, quality } = pose;
    announce(`Posição atual: ${x.toFixed(1)} metros, ${y.toFixed(1)} metros. Qualidade: ${quality}%.`);
  }, [pose, announce]);

  return {
    // SLAM
    slamStatus,
    pose,
    isNavigating,
    connectSlam,
    disconnectSlam,
    navigateTo,
    cancelNav,
    announcePosition,
    // Audio
    speak: announce,
    stopAudio: stop,
    setVolume,
    volume,
    isPlaying,
    isMqttOnline,
    lastAnnouncement,
  };
}
