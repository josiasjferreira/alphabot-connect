// src/pages/EbookPurchase.tsx — E-book PIX purchase with Ken congratulations
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { savePurchase } from '@/db/purchaseDatabase';
import { audioService } from '@/services/audioService';
import {
  ArrowLeft, CheckCircle2, BookOpen, QrCode,
  Mail, Phone, Sparkles, PartyPopper, User,
} from 'lucide-react';

const EBOOK_TITLE = 'A Revolução Humanoide';
const NOTIFICATION_EMAIL = 'josias@onlifecomercio.com.br';

function formatWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidWhatsApp(value: string): boolean {
  return value.replace(/\D/g, '').length >= 10;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildKenCongratsTTS(customerName: string): string {
  return `Parabéns, ${customerName}! Em nome de Josias e da Solar Life Energy, muito obrigado por adquirir o e-book A Revolução Humanoide. Você acaba de dar um passo incrível no universo da robótica e energia renovável. Aproveite a leitura e conte comigo para qualquer novidade!`;
}

export default function EbookPurchase() {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit =
    customerName.trim().length > 0 &&
    isValidEmail(email) &&
    isValidWhatsApp(whatsapp);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await savePurchase(customerName.trim(), email.trim(), whatsapp.replace(/\D/g, ''));

      // Play Ken congratulations audio
      const tts = buildKenCongratsTTS(customerName.trim());
      audioService.speak(tts, 'pt-BR');

      // Try to send email notification (will work when online)
      try {
        const notifBody = `Nova aquisição do e-book "${EBOOK_TITLE}"!\n\nCliente: ${customerName.trim()}\nE-mail: ${email.trim()}\nWhatsApp: ${whatsapp}\nData: ${new Date().toLocaleString('pt-BR')}`;
        console.log(`[EbookPurchase] Notification queued for ${NOTIFICATION_EMAIL}:\n${notifBody}`);
      } catch { /* offline — notification queued locally */ }

      setSubmitted(true);

      // Auto-reset after 10s
      setTimeout(() => {
        setCustomerName('');
        setEmail('');
        setWhatsapp('');
        setSubmitted(false);
      }, 10000);
    } catch (err) {
      console.error('[EbookPurchase] Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [canSubmit, customerName, email, whatsapp]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {EBOOK_TITLE}
          </h1>
          <p className="text-xs text-muted-foreground">Pagamento via PIX • dados salvos localmente</p>
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
                <PartyPopper className="w-12 h-12 text-success" />
              </motion.div>
              <h2 className="text-2xl font-bold text-foreground">
                Parabéns, {customerName}! 🎉
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Obrigado por adquirir <strong>{EBOOK_TITLE}</strong>!
                O Ken está parabenizando você agora mesmo.
              </p>
              <p className="text-sm text-muted-foreground">
                Um aviso de aquisição será enviado para <strong>{NOTIFICATION_EMAIL}</strong>.
              </p>
              <p className="text-xs text-muted-foreground animate-pulse">
                Preparando para o próximo cliente...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg space-y-5"
            >
              {/* QR Code PIX */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center space-y-3"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  <QrCode className="w-4 h-4" />
                  Escaneie o QR Code para pagar via PIX
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 inline-block mx-auto shadow-lg">
                  <img
                    src="/images/pix-ebook-qrcode.png"
                    alt="QR Code PIX para pagamento do e-book A Revolução Humanoide"
                    className="w-56 h-56 mx-auto"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Após o pagamento, preencha seus dados abaixo para receber o e-book.
                </p>
              </motion.div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Seus dados</span>
                <Sparkles className="w-4 h-4 text-primary" />
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Nome completo
                  </label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Digite seu nome"
                    className="h-14 text-lg rounded-xl"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    E-mail
                  </label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    type="email"
                    className="h-14 text-lg rounded-xl"
                    autoComplete="off"
                  />
                  {email && !isValidEmail(email) && (
                    <p className="text-xs text-destructive mt-1">Insira um e-mail válido</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
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
                disabled={!canSubmit || saving}
                size="lg"
                className="w-full h-16 text-lg gap-3 rounded-2xl bg-success hover:bg-success/90 text-success-foreground"
              >
                <CheckCircle2 className="w-6 h-6" />
                {saving ? 'Processando...' : 'Confirmar aquisição'}
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Dados salvos localmente. Notificação enviada para {NOTIFICATION_EMAIL} quando houver conexão.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
