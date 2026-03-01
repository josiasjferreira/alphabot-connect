/**
 * useAudioMQTT.ts
 * Hook de áudio — delega ao AudioService singleton
 *
 * Mantém a mesma interface pública para compatibilidade
 * com AudioPanel.tsx e demais consumidores.
 */

import { useCallback, useEffect, useState } from 'react';
import { audioService } from '@/services/audioService';

export interface UseAudioMQTTReturn {
  speak: (text: string) => void;
  stop: () => void;
  setVolume: (level: number) => void;
  volume: number;
  isPlaying: boolean;
  isMqttOnline: boolean;
}

export function useAudioMQTT(): UseAudioMQTTReturn {
  const [volume, setVolumeState] = useState(audioService.volume);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMqttOnline, setIsMqttOnline] = useState(false);

  useEffect(() => {
    return audioService.subscribe((state) => {
      setIsMqttOnline(state.mqttOnline);
      setIsPlaying(state.isPlaying);
      setVolumeState(state.volume);
    });
  }, []);

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    audioService.speak(text);
  }, []);

  const stop = useCallback(() => {
    audioService.stop();
  }, []);

  const setVolume = useCallback((level: number) => {
    audioService.setVolume(level);
  }, []);

  return { speak, stop, setVolume, volume, isPlaying, isMqttOnline };
}
