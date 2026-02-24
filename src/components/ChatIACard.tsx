import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMQTT } from '@/hooks/useMQTT';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { useRobotStore } from '@/store/useRobotStore';
import {
  MessageCircle, Send, ChevronDown, ChevronUp, Bot, User, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

// Local intent engine — matches keywords to responses
const INTENTS: { keywords: string[]; response: string; action?: string }[] = [
  { keywords: ['olá', 'oi', 'hello', 'bom dia', 'boa tarde', 'boa noite'], response: 'Olá! Eu sou o Ken, assistente da Solar Life. Como posso ajudar?' },
  { keywords: ['status', 'estado', 'como está'], response: '📊 Verificando status do robô...', action: 'check_status' },
  { keywords: ['bateria', 'carga', 'battery'], response: '🔋 Consultando nível de bateria...', action: 'check_battery' },
  { keywords: ['posição', 'onde', 'localização', 'mapa'], response: '📍 Verificando posição atual no mapa...', action: 'check_position' },
  { keywords: ['andar', 'mover', 'frente', 'ir'], response: '🚶 Enviarei o comando de movimento. Use o joystick para controle preciso.', action: 'suggest_joystick' },
  { keywords: ['parar', 'pare', 'stop'], response: '🛑 Enviando comando de parada...', action: 'stop' },
  { keywords: ['calibrar', 'calibração', 'sensor'], response: '🔧 Para calibrar sensores, acesse a página de Calibração no menu de configurações.' },
  { keywords: ['entrega', 'delivery', 'pedido'], response: '📦 Para gerenciar entregas, acesse o módulo de Delivery no dashboard de configuração.' },
  { keywords: ['ajuda', 'help', 'comandos'], response: '💡 Posso ajudar com: status, bateria, posição, movimento, calibração, entregas. Pergunte o que precisar!' },
  { keywords: ['nome', 'quem é você', 'quem é', 'apresente'], response: '🤖 Eu sou o Ken! Um robô assistente da Solar Life, modelo CSJBot CT300. Prazer em conhecê-lo!' },
];

function matchIntent(text: string): { response: string; action?: string } {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const intent of INTENTS) {
    if (intent.keywords.some(k => lower.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
      return intent;
    }
  }
  return { response: '🤔 Não entendi completamente. Tente perguntar sobre: status, bateria, posição, calibração ou diga "ajuda".' };
}

function getRobotContext(store: ReturnType<typeof useRobotStore.getState>, isConnected: boolean, serial: string): string {
  return `[Robô: ${serial} | MQTT: ${isConnected ? 'Conectado' : 'Desconectado'} | Logs: ${store.logs.length}]`;
}

const ChatIACard = () => {
  const { isConnected, publish } = useMQTT();
  const serial = useMQTTConfigStore((s) => s.robotSerial) || 'H13307';
  const robotStore = useRobotStore();
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', content: '👋 Olá! Sou o Ken. Pergunte sobre status, bateria, posição ou diga "ajuda".', ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleAction = useCallback((action?: string) => {
    if (!action || !isConnected) return;
    switch (action) {
      case 'check_status':
        publish(`robot/${serial}/status/request`, { timestamp: Date.now() });
        break;
      case 'check_battery':
        publish(`robot/${serial}/status/request`, { type: 'battery', timestamp: Date.now() });
        break;
      case 'check_position':
        publish(`robot/${serial}/status/request`, { type: 'position', timestamp: Date.now() });
        break;
      case 'stop':
        publish(`robot/${serial}/movement/stop`, { timestamp: Date.now() });
        break;
    }
  }, [isConnected, publish, serial]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate response delay
    setTimeout(() => {
      const { response, action } = matchIntent(text);
      const context = getRobotContext(robotStore, isConnected, serial);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `${response}\n\n_${context}_`,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
      handleAction(action);

      // Publish chat interaction via MQTT
      if (isConnected) {
        publish(`robot/${serial}/chat`, {
          user_message: text,
          bot_response: response,
          action: action || null,
          timestamp: Date.now(),
        });
      }
    }, 600 + Math.random() * 400);
  }, [input, robotStore, isConnected, serial, publish, handleAction]);

  const clearChat = () => {
    setMessages([{ id: '0', role: 'assistant', content: '👋 Chat limpo. Como posso ajudar?', ts: Date.now() }]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-2xl border border-border p-4 shadow-card"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between"
      >
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Chat IA — Ken
          <span className="text-[10px] font-normal text-muted-foreground">({messages.length - 1} msgs)</span>
        </h2>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Messages */}
            <div ref={scrollRef} className="mt-3 max-h-48 overflow-y-auto space-y-2 pr-1">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    {m.content.split('\n').map((line, i) => (
                      <span key={i}>
                        {line.startsWith('_') && line.endsWith('_')
                          ? <em className="text-[10px] text-muted-foreground block mt-1">{line.slice(1, -1)}</em>
                          : line}
                        {i < m.content.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-secondary" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted px-3 py-2 rounded-xl">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2 mt-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte ao Ken..."
                className="text-xs h-9"
              />
              <Button size="sm" className="h-9 px-3" onClick={handleSend} disabled={!input.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-9 px-2" onClick={clearChat}>
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChatIACard;
