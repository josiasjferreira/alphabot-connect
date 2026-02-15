import { useState, useEffect, useCallback, useMemo } from 'react';

// Verificar suporte ANTES de usar
const SpeechRecognitionAPI = 
  typeof window !== 'undefined' 
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
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
      const current = event.resultIndex;
      const transcriptText = event.results[current][0].transcript;
      setTranscript(transcriptText);
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

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
  };
};
