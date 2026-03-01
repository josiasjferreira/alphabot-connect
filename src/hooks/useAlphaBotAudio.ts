/**
 * useAlphaBotAudio.ts
 * Hook de áudio — delega ao AudioService singleton
 *
 * Mantém a interface pública para compatibilidade com consumidores existentes.
 * Beep e Alert usam audioService.speak() como fallback unificado.
 */

import { useCallback, useEffect, useState } from 'react';
import { audioService } from '@/services/audioService';

export interface UseAlphaBotAudioReturn {
  speak: (text: string, lang?: string) => void;
  beep: (duration?: number, frequency?: number) => void;
  alert: (type: 'success' | 'error' | 'warning') => void;
  setRobotVolume: (level: number) => void;
  isConnected: boolean;
  currentVolume: number;
}

export function useAlphaBotAudio(): UseAlphaBotAudioReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(audioService.volume);

  useEffect(() => {
    return audioService.subscribe((state) => {
      setIsConnected(state.mqttOnline);
      setCurrentVolume(state.volume);
    });
  }, []);

  const speak = useCallback((text: string, lang = 'pt-BR') => {
    audioService.speak(text, lang);
  }, []);

  const beep = useCallback((_duration = 300, _frequency = 1000) => {
    // Delegate to AudioService — beep topic could be added later
    audioService.speak('Beep');
  }, []);

  const alert = useCallback((type: 'success' | 'error' | 'warning') => {
    const messages = { success: 'Operação concluída.', error: 'Erro detectado.', warning: 'Atenção.' };
    audioService.speak(messages[type]);
  }, []);

  const setRobotVolume = useCallback((level: number) => {
    audioService.setVolume(level);
  }, []);

  return { speak, beep, alert, setRobotVolume, isConnected, currentVolume };
}
