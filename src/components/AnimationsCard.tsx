import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMQTT } from '@/hooks/useMQTT';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { useRobotStore } from '@/store/useRobotStore';
import { playBackgroundTone } from '@/lib/audioEffects';
import {
  Sparkles, Smile, Heart, Zap, Hand, PartyPopper,
  Eye, Frown, ChevronDown, ChevronUp, Volume2, MessageCircle, Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AnimationPreset {
  id: string;
  label: string;
  icon: React.ReactNode;
  expression: string;
  gesture?: string;
  color: string;
  tone: 'happy' | 'warm' | 'love' | 'celebrate' | 'magic' | 'alert';
  phrase?: string; // TTS phrase to speak
}

const PRESETS: AnimationPreset[] = [
  { id: 'happy', label: 'Alegria', icon: <Smile className="w-4 h-4" />, expression: 'happy', gesture: 'nod', color: 'bg-success/15 text-success border-success/20', tone: 'happy', phrase: 'Estou muito feliz!' },
  { id: 'love', label: 'Amor', icon: <Heart className="w-4 h-4" />, expression: 'love', gesture: 'heart', color: 'bg-destructive/15 text-destructive border-destructive/20', tone: 'love', phrase: 'Eu adoro vocês!' },
  { id: 'surprise', label: 'Surpresa', icon: <Zap className="w-4 h-4" />, expression: 'surprise', gesture: 'jump', color: 'bg-warning/15 text-warning border-warning/20', tone: 'magic', phrase: 'Uau, que surpresa!' },
  { id: 'wink', label: 'Piscadela', icon: <Eye className="w-4 h-4" />, expression: 'wink', color: 'bg-primary/15 text-primary border-primary/20', tone: 'happy' },
  { id: 'wave', label: 'Acenar', icon: <Hand className="w-4 h-4" />, expression: 'neutral', gesture: 'wave', color: 'bg-secondary/15 text-secondary border-secondary/20', tone: 'warm', phrase: 'Olá, tudo bem?' },
  { id: 'celebrate', label: 'Celebrar', icon: <PartyPopper className="w-4 h-4" />, expression: 'happy', gesture: 'celebrate', color: 'bg-accent/15 text-accent-foreground border-accent/20', tone: 'celebrate', phrase: 'Vamos comemorar! Isso é incrível!' },
  { id: 'sad', label: 'Triste', icon: <Frown className="w-4 h-4" />, expression: 'sad', color: 'bg-muted text-muted-foreground border-border', tone: 'alert' },
  { id: 'greeting', label: 'Boas-vindas', icon: <Volume2 className="w-4 h-4" />, expression: 'happy', gesture: 'greeting', color: 'bg-primary/15 text-primary border-primary/20', tone: 'warm', phrase: 'Olá! Bem-vindos à Solar Life! Eu sou o Ken, seu assistente robô.' },
];

const CONVITE_SCRIPT = `Olá, {{NOME_CONVIDADO}}, eu sou o Ken, o robô humanoide da Solar Life Energy. Que alegria falar com você!

Estou aqui para te fazer um convite muito especial. Você está convidado para a Feira de Energia Renováveis no Cais do Sertão. Um evento incrível, onde tecnologia, inovação e sustentabilidade se encontram para mostrar o futuro da energia limpa.

Lá você vai poder conhecer projetos inspiradores de energia renovável, trocar ideias com especialistas do setor e ver de perto como a tecnologia está transformando a forma como geramos e consumimos energia.

A sua presença, {{NOME_CONVIDADO}}, é muito importante. Juntos, podemos construir um futuro mais sustentável para todos.

A Solar Life Energy estará presente com soluções completas em energia solar, ajudando empresas e pessoas a economizar e a reduzir o impacto ambiental. E eu, o Ken, estarei lá pessoalmente para te receber, explicar tudo e interagir com você.

Vai ser uma honra te encontrar lá, {{NOME_CONVIDADO}}. Eu sou o Ken e estou esperando por você na Feira de Energia Renováveis no Cais do Sertão. Vamos juntos ligar o futuro na energia certa!`;

const speakPhrase = (text: string) => {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;
    window.speechSynthesis.speak(utterance);
  } catch {}
};

const AnimationsCard = () => {
  const { isConnected, publish } = useMQTT();
  const serial = useMQTTConfigStore((s) => s.robotSerial) || 'H13307';
  const { addLog } = useRobotStore();
  const [expanded, setExpanded] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nomeConvidado, setNomeConvidado] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const handleConvite = useCallback(() => {
    const nome = nomeConvidado.trim() || 'amigo';
    const script = CONVITE_SCRIPT.replace(/\{\{NOME_CONVIDADO\}\}/g, nome);
    setIsSpeaking(true);
    addLog(`🎙️ Convite TTS para: ${nome}`, 'info');

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.92;
      utterance.pitch = 1.1;
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith('pt'));
      if (ptVoice) utterance.voice = ptVoice;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }

    playBackgroundTone('warm', 0.15);
  }, [nomeConvidado, addLog]);

  const handleTrigger = useCallback((preset: AnimationPreset) => {
    setActiveId(preset.id);
    addLog(`🎭 Animação: ${preset.label}`, 'info');

    // Play synthesized tone
    playBackgroundTone(preset.tone, 0.2);

    // Speak phrase via TTS
    if (ttsEnabled && preset.phrase) {
      speakPhrase(preset.phrase);
    }

    if (isConnected) {
      publish(`robot/${serial}/cmd/animation`, {
        cmd: 'play_animation',
        params: {
          expression: preset.expression,
          gesture: preset.gesture || null,
          tts_text: preset.phrase || null,
        },
        timestamp: Date.now(),
      });

      publish(`csjbot/${serial}/cmd`, {
        cmd: 'expression',
        params: { name: preset.expression },
        timestamp: Date.now(),
      });

      if (preset.gesture) {
        publish(`robot/${serial}/cmd`, {
          cmd: 'gesture',
          params: { name: preset.gesture },
          timestamp: Date.now(),
        });
      }
    }

    setTimeout(() => setActiveId(null), 1200);
  }, [isConnected, publish, serial, addLog, ttsEnabled]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card rounded-2xl border border-border p-4 shadow-card"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between"
      >
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Animações & Expressões
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
            {/* TTS toggle */}
            <div className="flex items-center justify-end gap-1.5 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); setTtsEnabled(!ttsEnabled); }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                  ttsEnabled
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                <Volume2 className="w-3 h-3" />
                Voz {ttsEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTrigger(p)}
                  className={`h-auto flex-col gap-1 py-2.5 px-1 border transition-all ${
                    activeId === p.id ? p.color + ' scale-110' : ''
                  }`}
                >
                  <motion.div
                    animate={activeId === p.id ? { rotate: [0, -10, 10, 0], scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {p.icon}
                  </motion.div>
                  <span className="text-[10px] leading-tight font-medium">{p.label}</span>
                  {p.phrase && <Volume2 className="w-2.5 h-2.5 text-muted-foreground" />}
                </Button>
              ))}
            </div>

            {/* Convite personalizado TTS */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome do convidado..."
                  value={nomeConvidado}
                  onChange={(e) => setNomeConvidado(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <Button
                variant="default"
                size="lg"
                className="w-full gap-2 gradient-solar text-white font-bold text-sm py-3"
                disabled={isSpeaking}
                onClick={handleConvite}
              >
                <Mic className={`w-5 h-5 ${isSpeaking ? 'animate-pulse' : ''}`} />
                {isSpeaking ? 'Falando...' : 'Clique aqui para conversar'}
              </Button>
              {isSpeaking && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    window.speechSynthesis?.cancel();
                    setIsSpeaking(false);
                  }}
                >
                  ⏹ Parar
                </Button>
              )}
            </div>

            {!isConnected && (
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Conecte ao MQTT para enviar animações
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnimationsCard;
