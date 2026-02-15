// Fallback seguro para Text-to-Speech
export const speak = (text: string): boolean => {
  if (!window.speechSynthesis) {
    console.warn('speechSynthesis não suportado neste dispositivo');
    return false;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.error('Erro ao falar:', error);
    return false;
  }
};

export const stopSpeaking = (): void => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
};

export const isTTSSupported = (): boolean => {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
};
