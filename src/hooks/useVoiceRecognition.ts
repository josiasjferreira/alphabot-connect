import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

export const speak = (text: string) => {
  const { ttsVolume, ttsRate } = useSettingsStore.getState();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.volume = ttsVolume;
  utterance.rate = ttsRate;
  // Prefer masculine pt-BR voice for Ken
  const voices = speechSynthesis.getVoices();
  const maleVoice = voices.find(v => v.lang.startsWith('pt') && /male|masculin|ricardo|daniel/i.test(v.name))
    || voices.find(v => v.lang.startsWith('pt-BR'))
    || voices.find(v => v.lang.startsWith('pt'));
  if (maleVoice) utterance.voice = maleVoice;
  speechSynthesis.speak(utterance);
};

// Verificar suporte ANTES de usar
const SpeechRecognitionAPI = 
  typeof window !== 'undefined' 
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const isSupported = !!SpeechRecognitionAPI;

  const recognition = useMemo(() => {
    if (!SpeechRecognitionAPI) return null;
    
    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'pt-BR';
    return rec;
  }, []);

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final_ = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final_ += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final_) setTranscript(prev => prev + final_);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [recognition]);

  const startListening = useCallback(() => {
    if (!recognition || isListening) return;
    
    try {
      recognition.start();
      setIsListening(true);
      setTranscript('');
    } catch (error) {
      console.error('Failed to start recognition:', error);
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    if (!recognition || !isListening) return;
    
    try {
      recognition.stop();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  }, [recognition, isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
  };
};
