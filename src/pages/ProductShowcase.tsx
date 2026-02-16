import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Camera, Mic, MicOff, Save, ChevronLeft, ChevronRight, User, CheckCircle, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { useToast } from '@/hooks/use-toast';
import { useRobotStore } from '@/store/useRobotStore';

interface Product {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  videoPlaceholder: string;
}

const PRODUCTS: Product[] = [
  { id: 'residential', nameKey: 'showcase.products.residential.name', descKey: 'showcase.products.residential.desc', icon: '🏠', videoPlaceholder: 'residential-solar-kit.mp4' },
  { id: 'commercial', nameKey: 'showcase.products.commercial.name', descKey: 'showcase.products.commercial.desc', icon: '🏢', videoPlaceholder: 'commercial-solar-system.mp4' },
  { id: 'portable', nameKey: 'showcase.products.portable.name', descKey: 'showcase.products.portable.desc', icon: '🔋', videoPlaceholder: 'portable-solar-station.mp4' },
  { id: 'irrigation', nameKey: 'showcase.products.irrigation.name', descKey: 'showcase.products.irrigation.desc', icon: '🌱', videoPlaceholder: 'solar-irrigation.mp4' },
  { id: 'lighting', nameKey: 'showcase.products.lighting.name', descKey: 'showcase.products.lighting.desc', icon: '💡', videoPlaceholder: 'solar-lighting.mp4' },
];

const ProductShowcase = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { machineState, dispatchEvent } = useRobotStore();
  const isReceptionMode = machineState === 'RECEPTION';

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clientName, setClientName] = useState('');
  const [saved, setSaved] = useState(false);

  const { isRecording, photoUrl, startRecording, stopRecording, capturePhoto, saveSession, resetMedia } = useMediaRecorder();

  // If robot leaves RECEPTION state externally, go back to dashboard
  useEffect(() => {
    if (machineState === 'ERROR') {
      navigate('/dashboard');
    }
  }, [machineState, navigate]);

  const product = PRODUCTS[selectedIndex];

  const prev = () => { setSelectedIndex((i) => (i === 0 ? PRODUCTS.length - 1 : i - 1)); setIsPlaying(false); };
  const next = () => { setSelectedIndex((i) => (i === PRODUCTS.length - 1 ? 0 : i + 1)); setIsPlaying(false); };

  const handleSave = useCallback(async () => {
    if (!clientName.trim()) {
      toast({ title: t('showcase.enterName'), variant: 'destructive' });
      return;
    }
    if (isRecording) await stopRecording();
    await saveSession(product.id, clientName.trim());
    setSaved(true);
    toast({ title: t('showcase.saved') });
    setTimeout(() => { setSaved(false); resetMedia(); setClientName(''); }, 2000);
  }, [clientName, isRecording, stopRecording, saveSession, product.id, resetMedia, toast, t]);

  const handleEndReception = useCallback(() => {
    dispatchEvent('LEAVE_RECEPTION');
    navigate('/dashboard');
  }, [dispatchEvent, navigate]);

  return (
    <div className="h-screen bg-background flex flex-col">
      <StatusHeader title={t('showcase.title')} />

      <div className="flex-1 overflow-y-auto">
        {/* Reception Mode Banner */}
        {isReceptionMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">👋</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('showcase.receptionActive')}</p>
                <p className="text-xs text-muted-foreground">{t('showcase.receptionHint')}</p>
              </div>
            </div>
            <button
              onClick={handleEndReception}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('showcase.endReception')}
            </button>
          </motion.div>
        )}
        {/* Product Carousel */}
        <div className="relative px-4 pt-4">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prev} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-secondary-foreground" />
            </button>
            <div className="text-center flex-1">
              <span className="text-3xl">{product.icon}</span>
              <h2 className="font-bold text-lg text-foreground">{t(product.nameKey)}</h2>
              <p className="text-xs text-muted-foreground">{selectedIndex + 1}/{PRODUCTS.length}</p>
            </div>
            <button onClick={next} className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-secondary-foreground" />
            </button>
          </div>

          {/* Video Player (Mock) */}
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative w-full aspect-video bg-card rounded-2xl border border-border overflow-hidden mb-3"
          >
            {isPlaying ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Play className="w-8 h-8 text-primary" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{t('showcase.playingDemo')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{product.videoPlaceholder}</p>
                <button onClick={() => setIsPlaying(false)} className="mt-3 text-xs text-primary underline">{t('showcase.stopVideo')}</button>
              </div>
            ) : (
              <button onClick={() => setIsPlaying(true)} className="absolute inset-0 flex flex-col items-center justify-center group">
                <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                  <Play className="w-8 h-8 text-primary-foreground ml-1" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">{t('showcase.watchDemo')}</p>
              </button>
            )}
          </motion.div>

          {/* Product Description */}
          <p className="text-sm text-muted-foreground leading-relaxed px-1 mb-4">{t(product.descKey)}</p>
        </div>

        {/* Client Interaction Zone */}
        <div className="px-4 pb-6 space-y-3">
          <h3 className="font-bold text-sm text-foreground uppercase tracking-wider">{t('showcase.clientSection')}</h3>

          {/* Client Name */}
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t('showcase.clientNamePlaceholder')}
              className="flex-1 h-11 px-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Media Controls */}
          <div className="flex gap-2">
            {/* Audio Recording */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={isRecording ? () => stopRecording() : startRecording}
              className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-colors ${
                isRecording
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {isRecording ? t('showcase.stopRec') : t('showcase.startRec')}
            </motion.button>

            {/* Photo Capture */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={capturePhoto}
              className="flex-1 h-12 rounded-xl bg-secondary text-secondary-foreground flex items-center justify-center gap-2 font-semibold text-sm"
            >
              <Camera className="w-5 h-5" />
              {t('showcase.takePhoto')}
            </motion.button>
          </div>

          {/* Photo Preview */}
          <AnimatePresence>
            {photoUrl && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={photoUrl} alt={t('showcase.clientPhoto')} className="w-full h-40 object-cover" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={saved}
            className="w-full h-14 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center gap-2 font-bold text-base shadow-button disabled:opacity-60"
          >
            {saved ? <CheckCircle className="w-6 h-6" /> : <Save className="w-6 h-6" />}
            {saved ? t('showcase.savedSuccess') : t('showcase.saveInteraction')}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ProductShowcase;
