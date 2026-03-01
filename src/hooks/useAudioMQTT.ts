/**
 * useAudioMQTT.ts
 * Hook de áudio MQTT com persistência de volume e fallback Web Speech API
 *
 * Tópicos:
 *   alphabot/cmd/audio/play   → {text, lang, type:"tts"}
 *   alphabot/cmd/audio/volume → {level: 0-100}
 *   alphabot/cmd/audio/stop
 *   alphabot/status/audio     ← subscribe
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useMQTT } from '@/hooks/useMQTT';

const TOPICS = {
  PLAY: 'alphabot/cmd/audio/play',
  VOLUME: 'alphabot/cmd/audio/volume',
  STOP: 'alphabot/cmd/audio/stop',
  STATUS: 'alphabot/status/audio',
} as const;

const VOLUME_STORAGE_KEY = 'alphabot-audio-volume';

function getPersistedVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (v !== null) return Math.max(0, Math.min(100, Number(v)));
  } catch { /* noop */ }
  return 50;
}

export interface AudioStatusPayload {
  playing: boolean;
  text?: string;
}

export interface UseAudioMQTTReturn {
  speak: (text: string) => void;
  stop: () => void;
  setVolume: (level: number) => void;
  volume: number;
  isPlaying: boolean;
  isMqttOnline: boolean;
}

export function useAudioMQTT(): UseAudioMQTTReturn {
  const { publish, isConnected, client } = useMQTT();
  const [volume, setVolumeState] = useState(getPersistedVolume);
  const [isPlaying, setIsPlaying] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Subscribe to audio status
  useEffect(() => {
    if (!client || !isConnected) return;
    const mqttClient = (client as any)?.client; // underlying mqtt.js client
    if (!mqttClient) return;

    const handler = (topic: string, message: Buffer) => {
      if (topic === TOPICS.STATUS) {
        try {
          const data: AudioStatusPayload = JSON.parse(message.toString());
          setIsPlaying(data.playing);
        } catch { /* ignore */ }
      }
    };

    mqttClient.subscribe(TOPICS.STATUS);
    mqttClient.on('message', handler);
    return () => {
      mqttClient.unsubscribe(TOPICS.STATUS);
      mqttClient.removeListener('message', handler);
    };
  }, [client, isConnected]);

  // Speak via MQTT or fallback Web Speech API
  const speak = useCallback((text: string) => {
    if (!text.trim()) return;

    if (isConnected) {
      publish(TOPICS.PLAY, { text, lang: 'pt-BR', type: 'tts' });
      setIsPlaying(true);
      console.log(`🔊 [AudioMQTT] TTS: "${text}"`);
      return;
    }

    // Fallback: Web Speech API
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = 'pt-BR';
      utt.volume = volume / 100;
      utt.onstart = () => setIsPlaying(true);
      utt.onend = () => setIsPlaying(false);
      utt.onerror = () => setIsPlaying(false);
      speechRef.current = utt;
      window.speechSynthesis.speak(utt);
      console.log(`🗣️ [AudioMQTT] Web Speech fallback: "${text}"`);
    }
  }, [isConnected, publish, volume]);

  // Stop
  const stop = useCallback(() => {
    if (isConnected) {
      publish(TOPICS.STOP, {});
      console.log('⏹️ [AudioMQTT] Stop');
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, [isConnected, publish]);

  // Volume with persistence
  const setVolume = useCallback((level: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    setVolumeState(clamped);
    try { localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped)); } catch { /* noop */ }
    if (isConnected) {
      publish(TOPICS.VOLUME, { level: clamped });
      console.log(`🔉 [AudioMQTT] Volume: ${clamped}%`);
    }
  }, [isConnected, publish]);

  // Sync persisted volume on mount when connected
  useEffect(() => {
    if (isConnected) {
      publish(TOPICS.VOLUME, { level: volume });
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  return { speak, stop, setVolume, volume, isPlaying, isMqttOnline: isConnected };
}
