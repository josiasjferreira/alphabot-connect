import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMQTT } from '@/hooks/useMQTT';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { useRobotStore } from '@/store/useRobotStore';
import { playBackgroundTone } from '@/lib/audioEffects';
import {
  Sparkles, ChevronDown, ChevronUp, Volume2, Mic, Camera, Sun, User, Users, Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CONVITE_SCRIPT = `Olá, {{NOME_CONVIDADO}}, eu sou o Ken, o robô humanoide da Solar Life Energy. Que alegria falar com você!

Estou aqui para te fazer um convite muito especial. Você está convidado para a Feira de Energia Renováveis no Cais do Sertão. Um evento incrível, onde tecnologia, inovação e sustentabilidade se encontram para mostrar o futuro da energia limpa.

Lá você vai poder conhecer projetos inspiradores de energia renovável, trocar ideias com especialistas do setor e ver de perto como a tecnologia está transformando a forma como geramos e consumimos energia.

A sua presença, {{NOME_CONVIDADO}}, é muito importante. Juntos, podemos construir um futuro mais sustentável para todos.

A Solar Life Energy estará presente com soluções completas em energia solar, ajudando empresas e pessoas a economizar e a reduzir o impacto ambiental. E eu, o Ken, estarei lá pessoalmente para te receber, explicar tudo e interagir com você.

Vai ser uma honra te encontrar lá, {{NOME_CONVIDADO}}. Eu sou o Ken e estou esperando por você na Feira de Energia Renováveis no Cais do Sertão. Vamos juntos ligar o futuro na energia certa!`;

// Audio files for buttons (MP3)
const AUDIO_FILES: Record<string, string> = {
  fotos: '/audio/Ken_Convite_Fotos.mp3',
  solar: '/audio/Ken_Solar_Life_Energy.mp3',
  quem: '/audio/Quem_sou_eu_Ken_Robo_Recepcionista.mp3',
};

// TTS fallback scripts for buttons without MP3
const TTS_SCRIPTS: Record<string, string> = {
  destina: `Esta tecnologia se destina a todos que acreditam no futuro da energia limpa! Empresários que querem reduzir custos operacionais, famílias que desejam economizar na conta de luz, condomínios, indústrias, comércios e instituições públicas. Qualquer pessoa ou organização que queira investir em sustentabilidade e eficiência energética pode se beneficiar das soluções da Solar Life Energy.`,
  convide: `Gostou do que viu? Então convide seus amigos e familiares para conhecer a Solar Life Energy também! Compartilhe essa experiência incrível. Quanto mais pessoas conhecerem as vantagens da energia solar, mais rápido construímos um futuro sustentável. Indique a Solar Life para quem você gosta! Juntos, vamos transformar o mundo com energia limpa!`,
};

interface ActionButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  scriptKey: string;
  color: string;
}

const ACTION_BUTTONS: ActionButton[] = [
  { id: 'fotos', label: 'Ken Convida para fotos (Clique aqui)', icon: <Camera className="w-6 h-6" />, scriptKey: 'fotos', color: 'bg-primary/15 text-primary border-primary/30' },
  { id: 'solar', label: 'Conheça à Solar Life Energy', icon: <Sun className="w-6 h-6" />, scriptKey: 'solar', color: 'bg-warning/15 text-warning border-warning/30' },
  { id: 'quem', label: 'Quem sou eu', icon: <User className="w-6 h-6" />, scriptKey: 'quem', color: 'bg-secondary/15 text-secondary border-secondary/30' },
  { id: 'destina', label: 'Para quem se Destina esta tecnologia', icon: <Users className="w-6 h-6" />, scriptKey: 'destina', color: 'bg-success/15 text-success border-success/30' },
  { id: 'convide', label: 'Convide seus amigos', icon: <Share2 className="w-6 h-6" />, scriptKey: 'convide', color: 'bg-destructive/15 text-destructive border-destructive/30' },
];

const speakText = (text: string, onEnd?: () => void) => {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.92;
    utterance.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleConvite = useCallback(() => {
    const nome = nomeConvidado.trim() || 'amigo';
    const script = CONVITE_SCRIPT.replace(/\{\{NOME_CONVIDADO\}\}/g, nome);
    setIsSpeaking(true);
    setActiveId('convite');
    addLog(`🎙️ Convite TTS para: ${nome}`, 'info');
    speakText(script, () => { setIsSpeaking(false); setActiveId(null); });
    playBackgroundTone('warm', 0.15);
  }, [nomeConvidado, addLog]);

  const handleActionButton = useCallback((btn: ActionButton) => {
    setActiveId(btn.id);
    setIsSpeaking(true);
    addLog(`🎭 ${btn.label}`, 'info');
    playBackgroundTone('happy', 0.15);

    const audioFile = AUDIO_FILES[btn.scriptKey];
    if (audioFile) {
      // Play MP3 file
      if (audioRef.current) { audioRef.current.pause(); }
      audioRef.current = new Audio(audioFile);
      audioRef.current.onended = () => { setIsSpeaking(false); setActiveId(null); };
      audioRef.current.onerror = () => { setIsSpeaking(false); setActiveId(null); };
      audioRef.current.play().catch(() => { setIsSpeaking(false); setActiveId(null); });
    } else {
      // Fallback to TTS
      const script = TTS_SCRIPTS[btn.scriptKey];
      speakText(script, () => { setIsSpeaking(false); setActiveId(null); });
    }

    if (isConnected) {
      publish(`robot/${serial}/cmd/animation`, {
        cmd: 'play_animation',
        params: { expression: 'happy', gesture: 'wave' },
        timestamp: Date.now(),
      });
    }
  }, [isConnected, publish, serial, addLog]);

  const handleStop = () => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setIsSpeaking(false);
    setActiveId(null);
  };

  const handlePlayAudio = () => {
    setIsSpeaking(true);
    setActiveId('audio-mp3');
    if (!audioRef.current) {
      audioRef.current = new Audio('/audio/Ken_Robo_Recepcionista.mp3');
    }
    audioRef.current.currentTime = 0;
    audioRef.current.onended = () => { setIsSpeaking(false); setActiveId(null); };
    audioRef.current.play().catch(() => { setIsSpeaking(false); setActiveId(null); });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card rounded-2xl border border-border p-6 shadow-card"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between"
      >
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-primary" />
          Vamos Conversar ?
        </h2>
        {expanded ? (
          <ChevronUp className="w-6 h-6 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
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
            {/* Clique aqui para conversar — plays MP3 — right below title */}
            <div className="mt-4">
              <Button
                variant="default"
                size="lg"
                className="w-full gap-3 gradient-solar text-white font-bold text-xl py-6"
                disabled={isSpeaking}
                onClick={handlePlayAudio}
              >
                <Mic className={`w-7 h-7 ${activeId === 'audio-mp3' ? 'animate-pulse' : ''}`} />
                Clique aqui para conversar
              </Button>
            </div>

            {/* Action buttons in 2 columns */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              {ACTION_BUTTONS.map((btn) => (
                <Button
                  key={btn.id}
                  variant="outline"
                  onClick={() => handleActionButton(btn)}
                  disabled={isSpeaking && activeId !== btn.id}
                  className={`h-auto flex-col gap-3 py-6 px-4 border-2 transition-all text-center whitespace-normal leading-tight ${
                    activeId === btn.id ? btn.color + ' scale-105 ring-2 ring-primary/30' : ''
                  }`}
                >
                  <motion.div
                    animate={activeId === btn.id ? { rotate: [0, -10, 10, 0], scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {btn.icon}
                  </motion.div>
                  <span className="text-base font-bold leading-snug">{btn.label}</span>
                  {activeId === btn.id && isSpeaking && (
                    <Volume2 className="w-5 h-5 animate-pulse text-primary" />
                  )}
                </Button>
              ))}
            </div>

            {/* Convite personalizado TTS */}
            <div className="mt-6 space-y-3">
              <Input
                placeholder="Nome do convidado..."
                value={nomeConvidado}
                onChange={(e) => setNomeConvidado(e.target.value)}
                className="text-base h-12"
              />
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3 font-bold text-lg py-5 border-2 border-primary/30"
                disabled={isSpeaking}
                onClick={handleConvite}
              >
                <Mic className={`w-6 h-6 ${activeId === 'convite' ? 'animate-pulse' : ''}`} />
                {isSpeaking && activeId === 'convite' ? 'Falando convite...' : 'Convite Personalizado (TTS)'}
              </Button>
            </div>

            {/* Stop button */}
            {isSpeaking && (
              <Button
                variant="destructive"
                size="lg"
                className="w-full mt-4 text-lg font-bold py-5"
                onClick={handleStop}
              >
                ⏹ Parar
              </Button>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnimationsCard;
