// src/pages/LeadCapture.tsx — Ken Lead Capture (100% offline)
import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveLead } from '@/db/leadDatabase';
import { ArrowLeft, Volume2, CheckCircle2, UserPlus, Sparkles } from 'lucide-react';

const KEN_TTS_SCRIPT = `Olá! Eu sou o Ken, seu robô atendente humanoide da Solar Life Energy.
Que bom te encontrar aqui na feira! Eu quero muito manter contato com você depois desse evento.
Sabe por quê? Porque o universo da energia renovável, especialmente a energia solar, está avançando a passos largos.
E a robótica humanoide? Está cada vez mais presente no nosso dia a dia, facilitando tarefas e criando experiências incríveis.
Eu quero te manter por dentro de tudo isso! Novidades, convites para eventos, conteúdos exclusivos sobre tecnologia.
E pode ficar tranquilo, nada de spam! Só informações realmente relevantes.
Então, por favor, digite seu nome e seu WhatsApp na tela à minha frente.
É rapidinho! E eu vou te avisar sempre que surgir uma novidade importante nesse universo de energia renovável e robôs humanoides.
Vamos juntos nessa jornada tecnológica!`;

function formatWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidWhatsApp(value: string): boolean {
  return value.replace(/\D/g, '').length >= 10;
}

export default function LeadCapture() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const uttRef = useRef<SpeechSynthesisUtterance | null>(null);

  const playKenInvitation = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(KEN_TTS_SCRIPT);
    utt.lang = 'pt-BR';
    utt.rate = 0.92;
    utt.pitch = 0.95;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    uttRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim() || !isValidWhatsApp(whatsapp)) return;
    setSaving(true);
    try {
      await saveLead(name.trim(), whatsapp.replace(/\D/g, ''));
      setSubmitted(true);
      stopSpeaking();
      // Auto-reset after 6s for next visitor
      setTimeout(() => {
        setName('');
        setWhatsapp('');
        setSubmitted(false);
      }, 6000);
    } catch (err) {
      console.error('[LeadCapture] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Cadastro Ken – Novidades</h1>
          <p className="text-xs text-muted-foreground">100% offline • dados salvos localmente</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center max-w-md space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="w-12 h-12 text-success" />
              </motion.div>
              <h2 className="text-2xl font-bold text-foreground">Obrigado, {name}! 🤖</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                O Ken e a Solar Life Energy vão manter você atualizado sobre energia renovável e robôs humanoides.
              </p>
              <p className="text-xs text-muted-foreground animate-pulse">
                Preparando para o próximo visitante...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg space-y-6"
            >
              {/* Ken invitation button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <Button
                  onClick={isSpeaking ? stopSpeaking : playKenInvitation}
                  size="lg"
                  className={`h-16 px-8 text-lg gap-3 rounded-2xl w-full ${
                    isSpeaking
                      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  }`}
                >
                  <Volume2 className={`w-6 h-6 ${isSpeaking ? 'animate-pulse' : ''}`} />
                  {isSpeaking ? 'Parar áudio do Ken' : '🤖 Ouvir convite do Ken'}
                </Button>
              </motion.div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Preencha seus dados</span>
                <Sparkles className="w-4 h-4 text-primary" />
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    Nome completo
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Digite seu nome"
                    className="h-14 text-lg rounded-xl"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 block">
                    WhatsApp (DDD + número)
                  </label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                    placeholder="(99) 99999-9999"
                    inputMode="tel"
                    className="h-14 text-lg rounded-xl font-mono"
                    autoComplete="off"
                  />
                  {whatsapp && !isValidWhatsApp(whatsapp) && (
                    <p className="text-xs text-destructive mt-1">Insira DDD + número (mínimo 10 dígitos)</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || !isValidWhatsApp(whatsapp) || saving}
                size="lg"
                className="w-full h-16 text-lg gap-3 rounded-2xl bg-success hover:bg-success/90 text-success-foreground"
              >
                <UserPlus className="w-6 h-6" />
                {saving ? 'Salvando...' : 'Quero receber novidades'}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Seus dados ficam salvos localmente no dispositivo. Sem internet necessária.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
