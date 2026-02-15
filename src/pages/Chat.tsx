import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, MicOff, Trash2 } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import ChatBubble from '@/components/ChatBubble';
import { useVoiceRecognition, speak } from '@/hooks/useVoiceRecognition';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const getBotResponse = (userMessage: string, battery: number): { text: string; action?: string } => {
  const msg = userMessage.toLowerCase().trim();

  const patterns: [RegExp, string, string?][] = [
    [/^(ol[aá]|oi|hey|e a[ií])\b/i, 'Olá! Como posso ajudá-lo hoje? 🤖', undefined],
    [/como (voc[eê]|est[aá])/i, 'Estou funcionando perfeitamente! Todos os sistemas operacionais. ✅', undefined],
    [/bateria|carga|energia/i, `Minha bateria está em ${battery}%. ${battery > 50 ? 'Nível bom!' : 'Considere recarregar em breve.'}`, 'status'],
    [/(ir para|v[aá] para|navegu[ei]|mov[ae])/i, 'Entendido! Iniciando navegação para o local solicitado... 🗺️', 'navigate'],
    [/(par[ea]|stop|freio)/i, 'Parando todos os movimentos agora! 🛑', 'emergency'],
    [/status|estado|sistema/i, `Status: Bateria ${battery}%, temp. normal, WiFi estável. Tudo OK! 📊`, 'status'],
    [/(frente|avante|avan[cç])/i, 'Movendo para frente! ⬆️', 'navigate'],
    [/(tr[aá]s|recue|volte)/i, 'Recuando! ⬇️', 'navigate'],
    [/(esquerda|left)/i, 'Virando à esquerda! ⬅️', 'navigate'],
    [/(direita|right)/i, 'Virando à direita! ➡️', 'navigate'],
    [/(onde|posi[cç][aã]o|localiza)/i, 'Estou na posição X: 5.2m, Y: 3.8m, orientação: 45° NE. 📍', 'status'],
    [/(ajuda|help|comando)/i, 'Posso ajudá-lo com: navegar, verificar bateria, status do sistema, controle de movimento. O que deseja?', undefined],
    [/(obrigad|valeu|thank)/i, 'Por nada! Estou sempre aqui para ajudar! 😊', undefined],
    [/(foto|câmera|image)/i, 'Ativando câmera... O feed está disponível na tela de controle. 📹', undefined],
    [/(mapa|planta)/i, 'O mapa está disponível na seção de navegação. Deseja que eu vá para algum local específico?', undefined],
  ];

  for (const [pattern, response, action] of patterns) {
    if (pattern.test(msg)) {
      return { text: response, action };
    }
  }

  return { text: 'Entendi! Posso ajudar com navegação, status do sistema ou controle de movimento. O que você precisa? 🤔' };
};

const STORAGE_KEY = 'alphabot-chat-history';

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {}
    return [{
      id: '1',
      sender: 'bot' as const,
      text: 'Olá! Sou o AlphaBot CT300-H13307. Como posso ajudá-lo hoje? 🤖',
      timestamp: new Date(),
    }];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { status } = useRobotStore();
  const { send: wsSend } = useWebSocket();
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript } = useVoiceRecognition();

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle voice transcript
  useEffect(() => {
    if (transcript && !isListening) {
      setInput(transcript);
      resetTranscript();
    }
  }, [transcript, isListening, resetTranscript]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate bot thinking
    setTimeout(() => {
      try {
        const { text: botText, action } = getBotResponse(text, status.battery);

        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: botText,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);

        // Execute action via WebSocket
        if (action) {
          wsSend({ type: action === 'emergency' ? 'emergency_stop' : action as any, data: { command: text }, timestamp: Date.now() });
        }

        // Speak response
        speak(botText);
      } catch (e) {
        console.error('Chat response error:', e);
        setIsTyping(false);
      }
    }, 600 + Math.random() * 800);
  }, [status.battery, wsSend]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearHistory = () => {
    setMessages([{
      id: Date.now().toString(),
      sender: 'bot',
      text: 'Histórico limpo! Como posso ajudá-lo? 🤖',
      timestamp: new Date(),
    }]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const formatTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="h-screen bg-background flex flex-col">
      <StatusHeader title="💬 Chat com AlphaBot" />

      {/* Clear button */}
      <div className="px-4 py-2 flex justify-end">
        <button onClick={clearHistory} className="text-xs text-muted-foreground flex items-center gap-1 active:text-destructive">
          <Trash2 className="w-3 h-3" /> Limpar
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {messages.map((msg, i) => (
          <ChatBubble
            key={msg.id}
            sender={msg.sender}
            text={msg.text}
            time={formatTime(msg.timestamp)}
            index={i}
          />
        ))}

        {isTyping && (
          <div className="flex justify-start mb-3">
            <div className="bg-chat-bot text-chat-bot-foreground px-4 py-3 rounded-2xl rounded-bl-md">
              <motion.div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 bg-muted-foreground rounded-full"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* Voice interim */}
      {isListening && interimTranscript && (
        <div className="px-4 py-2 bg-primary/5 text-sm text-muted-foreground italic border-t border-border">
          🎤 {interimTranscript}
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="px-4 py-3 bg-card border-t border-border safe-bottom">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-semibold transition-colors
              ${isListening
                ? 'gradient-danger text-destructive-foreground animate-recording'
                : 'bg-secondary text-secondary-foreground'
              }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 h-12 px-4 rounded-xl bg-background border border-border text-foreground text-lg
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />

          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!input.trim()}
            className="w-12 h-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center flex-shrink-0
              disabled:opacity-40 shadow-button disabled:shadow-none"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
