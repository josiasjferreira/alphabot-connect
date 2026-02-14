import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, Check, AlertCircle } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { useVoiceRecognition, speak } from '@/hooks/useVoiceRecognition';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRobotStore } from '@/store/useRobotStore';

interface CommandResult {
  command: string;
  success: boolean;
  response: string;
  timestamp: Date;
}

const availableCommands = [
  { text: 'Vá para frente', icon: '⬆️' },
  { text: 'Vá para trás', icon: '⬇️' },
  { text: 'Vire à esquerda', icon: '⬅️' },
  { text: 'Vire à direita', icon: '➡️' },
  { text: 'Pare', icon: '🛑' },
  { text: 'Status da bateria', icon: '🔋' },
  { text: 'Onde estou?', icon: '📍' },
];

const processCommand = (text: string, battery: number): { response: string; success: boolean } => {
  const cmd = text.toLowerCase();
  if (/frente|avan[cç]/.test(cmd)) return { response: 'Movendo para frente!', success: true };
  if (/tr[aá]s|recue/.test(cmd)) return { response: 'Movendo para trás!', success: true };
  if (/esquerda/.test(cmd)) return { response: 'Virando à esquerda!', success: true };
  if (/direita/.test(cmd)) return { response: 'Virando à direita!', success: true };
  if (/par[ea]|stop/.test(cmd)) return { response: 'Robô parado!', success: true };
  if (/bateria|carga/.test(cmd)) return { response: `Bateria em ${battery}%`, success: true };
  if (/onde|posi[cç]/.test(cmd)) return { response: 'Posição: X: 5.2m, Y: 3.8m', success: true };
  return { response: 'Comando não reconhecido. Tente novamente.', success: false };
};

const Voice = () => {
  const [history, setHistory] = useState<CommandResult[]>([]);
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript } = useVoiceRecognition();
  const { send } = useWebSocket();
  const { status, addLog } = useRobotStore();

  const executeCommand = useCallback((text: string) => {
    const { response, success } = processCommand(text, status.battery);
    const result: CommandResult = {
      command: text,
      success,
      response,
      timestamp: new Date(),
    };
    setHistory(prev => [result, ...prev].slice(0, 5));
    speak(response);
    addLog(`Comando de voz: "${text}" → ${response}`, success ? 'success' : 'warning');

    if (success) {
      send({ type: 'voice_command', data: { command: text }, timestamp: Date.now() });
    }
  }, [status.battery, send, addLog]);

  // Process completed transcript
  if (transcript && !isListening) {
    executeCommand(transcript);
    resetTranscript();
  }

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title="🎤 Comandos de Voz" />

      <div className="flex-1 p-4 flex flex-col items-center gap-6">
        {/* Big mic button */}
        <div className="flex flex-col items-center gap-4 mt-4">
          <div className="relative">
            {isListening && (
              <motion.div
                className="absolute inset-0 rounded-full bg-primary/20"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={isListening ? stopListening : startListening}
              className={`relative w-32 h-32 rounded-full flex items-center justify-center text-primary-foreground
                ${isListening ? 'gradient-danger shadow-emergency' : 'gradient-primary shadow-button'}`}
            >
              {isListening ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
            </motion.button>
          </div>

          <p className="text-sm font-semibold text-muted-foreground">
            {isListening ? 'Ouvindo... Fale agora!' : 'Toque para falar'}
          </p>

          {isListening && interimTranscript && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 py-2 bg-card rounded-xl border border-border text-sm text-foreground text-center"
            >
              🎤 {interimTranscript}
            </motion.div>
          )}

          {/* Volume indicator */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Volume2 className="w-4 h-4" />
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`w-2 rounded-full transition-all ${
                    isListening && i <= 3 ? 'h-4 bg-primary animate-pulse' : 'h-2 bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Available commands */}
        <div className="w-full">
          <h3 className="text-xs font-bold text-muted-foreground mb-2">COMANDOS DISPONÍVEIS</h3>
          <div className="bg-card rounded-2xl border border-border shadow-card p-3 space-y-2">
            {availableCommands.map((cmd) => (
              <div key={cmd.text} className="flex items-center gap-3 py-1 text-sm text-foreground">
                <span className="text-base">{cmd.icon}</span>
                <span className="font-medium">"{cmd.text}"</span>
              </div>
            ))}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="w-full">
            <h3 className="text-xs font-bold text-muted-foreground mb-2">ÚLTIMOS COMANDOS</h3>
            <div className="space-y-2">
              {history.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-card rounded-xl border border-border p-3 flex items-center gap-3"
                >
                  {item.success ? (
                    <Check className="w-5 h-5 text-success flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">"{item.command}"</p>
                    <p className="text-xs text-muted-foreground">{item.response}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Voice;
