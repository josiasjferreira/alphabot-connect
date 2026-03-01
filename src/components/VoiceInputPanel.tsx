/**
 * VoiceInputPanel — Painel compacto de reconhecimento de voz para controle manual.
 * Exibe botão de mic, transcrição em tempo real e configurações de idioma/continuous.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Settings2, Volume2, Trash2 } from 'lucide-react';
import { useVoiceRecognition, speak } from '@/hooks/useVoiceRecognition';
import { Button } from '@/components/ui/button';

interface VoiceInputPanelProps {
  onCommand?: (text: string) => void;
  compact?: boolean;
}

const VoiceInputPanel = ({ onCommand, compact = false }: VoiceInputPanelProps) => {
  const {
    isListening, transcript, interimTranscript,
    startListening, stopListening, resetTranscript, isSupported,
  } = useVoiceRecognition();
  const [showSettings, setShowSettings] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
      if (transcript.trim()) {
        const cmd = transcript.trim();
        setHistory(prev => [cmd, ...prev].slice(0, 5));
        onCommand?.(cmd);
        if (autoSpeak) speak(`Comando recebido: ${cmd}`);
        resetTranscript();
      }
    } else {
      resetTranscript();
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-card rounded-xl border border-border p-3 text-center">
        <p className="text-xs text-muted-foreground">🎤 Reconhecimento de voz não suportado neste navegador</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <Mic className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-foreground">Voice Input</span>
          {isListening && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/20 text-destructive animate-pulse">
              REC
            </span>
          )}
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 rounded-lg hover:bg-muted/50"
        >
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Mic button + transcript */}
        <div className="flex items-center gap-3">
          <div className="relative">
            {isListening && (
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
            <button
              onClick={handleToggle}
              className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isListening
                  ? 'bg-destructive text-destructive-foreground shadow-lg'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex-1 min-w-0">
            {isListening && interimTranscript ? (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-foreground truncate"
              >
                🎤 {interimTranscript}
              </motion.p>
            ) : transcript ? (
              <p className="text-sm text-foreground truncate">✅ {transcript}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isListening ? 'Ouvindo... fale um comando' : 'Toque para falar'}
              </p>
            )}
            {/* Volume bars */}
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all ${
                    isListening && i <= 3
                      ? 'h-3 bg-primary animate-pulse'
                      : 'h-1.5 bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {transcript && (
            <button onClick={resetTranscript} className="p-1.5 rounded-lg hover:bg-muted">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Recent voice commands */}
        {history.length > 0 && !compact && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Últimos comandos</p>
            {history.slice(0, 3).map((cmd, i) => (
              <div
                key={i}
                className="text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-2 py-1 truncate cursor-pointer hover:bg-muted/50"
                onClick={() => onCommand?.(cmd)}
              >
                🗣️ "{cmd}"
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 pt-2 border-t border-border"
            >
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                  Confirmar por voz
                </label>
                <button
                  onClick={() => setAutoSpeak(!autoSpeak)}
                  className={`w-8 h-4 rounded-full transition-colors ${
                    autoSpeak ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full bg-background transition-transform mx-0.5 ${
                    autoSpeak ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground">Idioma</label>
                <span className="text-[11px] font-mono text-foreground">pt-BR</span>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground">Modo</label>
                <span className="text-[11px] font-mono text-foreground">Contínuo</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VoiceInputPanel;
