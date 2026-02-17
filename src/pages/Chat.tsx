import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Send, Mic, MicOff, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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

const STORAGE_KEY = 'alphabot-chat-history';

const Chat = () => {
  const { t } = useTranslation();

  const getBotResponse = useCallback((userMessage: string, battery: number): { text: string; action?: string } => {
    const msg = userMessage.toLowerCase().trim();
    const patterns: [RegExp, string, string?][] = [
      [/\bken\b/i, t('chat.responses.ken'), undefined],
      [/^(ol[aá]|oi|hey|e a[ií])\b/i, t('chat.responses.hello'), undefined],
      [/como (voc[eê]|est[aá])/i, t('chat.responses.howAreYou'), undefined],
      [/bateria|carga|energia/i, t('chat.responses.battery', { battery, status: battery > 50 ? t('chat.responses.batteryGood') : t('chat.responses.batteryLow') }), 'status'],
      [/(ir para|v[aá] para|navegu[ei]|mov[ae])/i, t('chat.responses.navigate'), 'navigate'],
      [/(par[ea]|stop|freio)/i, t('chat.responses.stop'), 'emergency'],
      [/status|estado|sistema/i, t('chat.responses.status', { battery }), 'status'],
      [/(frente|avante|avan[cç])/i, t('chat.responses.forward'), 'navigate'],
      [/(tr[aá]s|recue|volte)/i, t('chat.responses.backward'), 'navigate'],
      [/(esquerda|left)/i, t('chat.responses.left'), 'navigate'],
      [/(direita|right)/i, t('chat.responses.right'), 'navigate'],
      [/(onde|posi[cç][aã]o|localiza)/i, t('chat.responses.position'), 'status'],
      [/(ajuda|help|comando)/i, t('chat.responses.help'), undefined],
      [/(obrigad|valeu|thank)/i, t('chat.responses.thanks'), undefined],
      [/(foto|câmera|image)/i, t('chat.responses.camera'), undefined],
      [/(mapa|planta)/i, t('chat.responses.map'), undefined],
    ];
    for (const [pattern, response, action] of patterns) {
      if (pattern.test(msg)) return { text: response, action };
    }
    return { text: t('chat.responses.fallback') };
  }, [t]);

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {}
    return [{ id: '1', sender: 'bot' as const, text: t('chat.welcomeMessage'), timestamp: new Date() }];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { status } = useRobotStore();
  const { send: wsSend } = useWebSocket();
  const { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript } = useVoiceRecognition();

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (transcript && !isListening) { setInput(transcript); resetTranscript(); }
  }, [transcript, isListening, resetTranscript]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      try {
        const { text: botText, action } = getBotResponse(text, status.battery);
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: botText, timestamp: new Date() }]);
        setIsTyping(false);
        if (action) wsSend({ type: action === 'emergency' ? 'emergency_stop' : action as any, data: { command: text }, timestamp: Date.now() });
        speak(botText);
      } catch (e) { console.error('Chat response error:', e); setIsTyping(false); }
    }, 600 + Math.random() * 800);
  }, [status.battery, wsSend, getBotResponse]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const clearHistory = () => {
    setMessages([{ id: Date.now().toString(), sender: 'bot', text: t('chat.clearedMessage'), timestamp: new Date() }]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const formatTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="h-screen bg-background flex flex-col">
      <StatusHeader title={t('chat.title')} />
      <div className="px-4 py-2 flex justify-end">
        <button onClick={clearHistory} className="text-xs text-muted-foreground flex items-center gap-1 active:text-destructive">
          <Trash2 className="w-3 h-3" /> {t('chat.clear')}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {messages.map((msg, i) => (
          <ChatBubble key={msg.id} sender={msg.sender} text={msg.text} time={formatTime(msg.timestamp)} index={i} />
        ))}
        {isTyping && (
          <div className="flex justify-start mb-3">
            <div className="bg-chat-bot text-chat-bot-foreground px-4 py-3 rounded-2xl rounded-bl-md">
              <motion.div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="w-2 h-2 bg-muted-foreground rounded-full" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }} />
                ))}
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {isListening && interimTranscript && (
        <div className="px-4 py-2 bg-primary/5 text-sm text-muted-foreground italic border-t border-border">🎤 {interimTranscript}</div>
      )}

      <form onSubmit={handleSubmit} className="px-4 py-3 bg-card border-t border-border safe-bottom">
        <div className="flex items-center gap-2">
          <button type="button" onClick={isListening ? stopListening : startListening}
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-semibold transition-colors ${isListening ? 'gradient-danger text-destructive-foreground animate-recording' : 'bg-secondary text-secondary-foreground'}`}>
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('chat.inputPlaceholder')}
            className="flex-1 h-12 px-4 rounded-xl bg-background border border-border text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!input.trim()}
            className="w-12 h-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-40 shadow-button disabled:shadow-none">
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
