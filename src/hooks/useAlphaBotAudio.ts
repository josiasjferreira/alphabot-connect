/**
 * useAlphaBotAudio.ts
 * Hook de áudio via MQTT — AlphaBot Connect
 *
 * Fluxo: Tablet (React) → MQTT WS :9002 → PC Broker → TCP :1883 → Placa Android (.10) → TTS/Speaker
 *
 * Baseado no "Guia de Integração AlphaBot — Rede, Status e Áudio v3.0"
 */

import { useCallback, useState } from 'react';
import { useMQTT } from '@/hooks/useMQTT';
import { MQTT_CONFIG } from '@/config/mqtt';
import { playBackgroundTone } from '@/lib/audioEffects';

export interface AudioStatus {
  playing: boolean;
  queue: number;
}

export interface UseAlphaBotAudioReturn {
  /** Faz o robô falar via TTS */
  speak: (text: string, lang?: string) => void;
  /** Emite um beep no robô */
  beep: (duration?: number, frequency?: number) => void;
  /** Toca um som de alerta predefinido */
  alert: (type: 'success' | 'error' | 'warning') => void;
  /** Ajusta o volume do robô (0-100) */
  setRobotVolume: (level: number) => void;
  /** Status do MQTT */
  isConnected: boolean;
  /** Volume atual enviado */
  currentVolume: number;
}

export function useAlphaBotAudio(): UseAlphaBotAudioReturn {
  const { publish, isConnected } = useMQTT();
  const [currentVolume, setCurrentVolume] = useState(() => {
    try {
      const v = localStorage.getItem('alphabot-audio-volume');
      if (v !== null) return Math.max(0, Math.min(100, Number(v)));
    } catch { /* noop */ }
    return 50;
  });

  const speak = useCallback((text: string, lang = 'pt-BR') => {
    if (!isConnected) {
      console.warn('[AlphaBotAudio] MQTT não conectado — fallback local');
      playBackgroundTone('happy', 0.15);
      return;
    }
    publish(MQTT_CONFIG.TOPICS.AUDIO_TTS, { text, lang });
    console.log(`🔊 [AlphaBotAudio] TTS publish: "${text}" (${lang})`);
  }, [isConnected, publish]);

  const beep = useCallback((duration = 300, frequency = 1000) => {
    if (!isConnected) {
      playBackgroundTone('alert', 0.15);
      return;
    }
    publish(MQTT_CONFIG.TOPICS.AUDIO_BEEP, { duration, frequency });
    console.log(`🔔 [AlphaBotAudio] Beep: ${duration}ms @ ${frequency}Hz`);
  }, [isConnected, publish]);

  const alert = useCallback((type: 'success' | 'error' | 'warning') => {
    if (!isConnected) {
      const toneMap = { success: 'celebrate', error: 'alert', warning: 'warm' } as const;
      playBackgroundTone(toneMap[type] as any, 0.15);
      return;
    }
    publish(MQTT_CONFIG.TOPICS.AUDIO_ALERT, { type });
    console.log(`⚠️ [AlphaBotAudio] Alert: ${type}`);
  }, [isConnected, publish]);

  const setRobotVolume = useCallback((level: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    setCurrentVolume(clamped);
    try { localStorage.setItem('alphabot-audio-volume', String(clamped)); } catch { /* noop */ }
    if (!isConnected) return;
    publish(MQTT_CONFIG.TOPICS.AUDIO_VOLUME, { level: clamped });
    console.log(`🔉 [AlphaBotAudio] Volume: ${clamped}%`);
  }, [isConnected, publish]);

  return {
    speak,
    beep,
    alert,
    setRobotVolume,
    isConnected,
    currentVolume,
  };
}