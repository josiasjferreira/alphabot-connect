import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Save, User, Phone, CheckCircle, LogOut,
  Maximize2, Minimize2, ChevronRight, Sparkles, MessageCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import SolarProductModal from '@/components/SolarProductModal';
import AudioPanel from '@/components/AudioPanel';
import { SOLAR_PRODUCTS, type SolarProduct } from '@/data/solarProducts';
import { useToast } from '@/hooks/use-toast';
import { useRobotStore } from '@/store/useRobotStore';
import { useMQTT } from '@/hooks/useMQTT';
import { saveInteraction } from '@/db/interactionDatabase';

const SLIDESHOW_INTERVAL = 6000; // ms

const ProductShowcase = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { machineState, dispatchEvent } = useRobotStore();
  const { publish, isConnected } = useMQTT();
  const isReceptionMode = machineState === 'RECEPTION';

  const [selectedProduct, setSelectedProduct] = useState<SolarProduct | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  const [saved, setSaved] = useState(false);
  const [fairMode, setFairMode] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const slideshowRef = useRef<ReturnType<typeof setTimeout>>();
  const videoFallbackRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-log page access
  useEffect(() => {
    saveInteraction({
      id: `access-${Date.now()}`,
      clientName: '',
      clientWhatsapp: '',
      productId: 'page-access',
      texts: [`Acesso à página de produtos em ${new Date().toLocaleString()}`],
      createdAt: Date.now(),
      synced: false,
    });
  }, []);

  useEffect(() => {
    if (machineState === 'ERROR') navigate('/dashboard');
  }, [machineState, navigate]);

  // Only slideshow products that have video (skip chat-only card)
  const slideshowProducts = useMemo(() => SOLAR_PRODUCTS.filter(p => p.videoUrl), []);

  const advanceSlideshow = useCallback(() => {
    setSlideshowIndex(prev => (prev + 1) % slideshowProducts.length);
  }, [slideshowProducts.length]);

  // Slideshow auto-play — timer for non-video cards, fallback for video cards
  useEffect(() => {
    if (!slideshowActive) return;
    const current = slideshowProducts[slideshowIndex];
    if (!current?.videoUrl) {
      slideshowRef.current = setTimeout(advanceSlideshow, SLIDESHOW_INTERVAL);
    } else {
      // Safety fallback: if onEnded doesn't fire after 120s, advance anyway
      videoFallbackRef.current = setTimeout(advanceSlideshow, 120000);
    }
    return () => {
      if (slideshowRef.current) clearTimeout(slideshowRef.current);
      if (videoFallbackRef.current) clearTimeout(videoFallbackRef.current);
    };
  }, [slideshowActive, slideshowIndex, advanceSlideshow, slideshowProducts]);

  const handleProductClick = useCallback((product: SolarProduct) => {
    // Card 5 (action: open-chat) → navigate to Chat IA
    if (product.action === 'open-chat') {
      navigate('/chat');
      return;
    }
    setSelectedProduct(product);
    // Log view
    saveInteraction({
      id: `view-${product.id}-${Date.now()}`,
      clientName: clientName || 'anônimo',
      clientWhatsapp: clientWhatsapp || '',
      productId: product.id,
      texts: [`Visualizou produto: ${product.id}`],
      createdAt: Date.now(),
      synced: false,
    });
    if (isConnected) {
      publish('solar-life/product-viewed', {
        productId: product.id,
        timestamp: Date.now(),
      });
    }
  }, [clientName, clientWhatsapp, isConnected, publish, navigate]);

  const handleSave = useCallback(async () => {
    if (!clientName.trim()) {
      toast({ title: t('showcase.enterName'), variant: 'destructive' });
      return;
    }
    await saveInteraction({
      id: `interaction-${Date.now()}`,
      clientName: clientName.trim(),
      clientWhatsapp: clientWhatsapp.trim(),
      productId: selectedProduct?.id ?? 'general',
      texts: [`Cliente: ${clientName}`, `WhatsApp: ${clientWhatsapp}`, `Produto: ${selectedProduct?.id ?? 'geral'}`],
      createdAt: Date.now(),
      synced: false,
    });
    setSaved(true);
    toast({ title: t('showcase.saved') });
    setTimeout(() => { setSaved(false); setClientName(''); setClientWhatsapp(''); }, 2000);
  }, [clientName, clientWhatsapp, selectedProduct, toast, t]);

  const handleEndReception = useCallback(() => {
    dispatchEvent('LEAVE_RECEPTION');
    navigate('/dashboard');
  }, [dispatchEvent, navigate]);

  const toggleFairMode = () => setFairMode(f => !f);
  const toggleSlideshow = () => setSlideshowActive(s => !s);

  const slideshowProduct = slideshowProducts[slideshowIndex];

  return (
    <div className={`min-h-screen bg-background flex flex-col ${fairMode ? 'fixed inset-0 z-50' : ''}`}>
      {!fairMode && <StatusHeader title={t('showcase.title')} />}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        {fairMode ? (
          <button onClick={toggleFairMode} className="flex items-center gap-1 text-xs text-muted-foreground">
            <Minimize2 className="w-4 h-4" /> Sair Modo Feira
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {isReceptionMode && (
              <button
                onClick={handleEndReception}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold"
              >
                <LogOut className="w-3.5 h-3.5" /> {t('showcase.endReception')}
              </button>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSlideshow}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              slideshowActive ? 'gradient-solar text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            {slideshowActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            Auto
          </button>
          <button
            onClick={toggleFairMode}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Feira
          </button>
        </div>
      </div>

      {/* Slideshow Hero (when active) */}
      <AnimatePresence mode="popLayout">
        {slideshowActive && slideshowProduct && (
          <motion.div
            key={`slide-${slideshowIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="mx-4 mt-2 rounded-3xl overflow-hidden shadow-xl cursor-pointer"
            onClick={() => { setSlideshowActive(false); handleProductClick(slideshowProduct); }}
          >
            {slideshowProduct.videoUrl ? (
              <div className="relative">
                <video
                  key={`video-${slideshowIndex}-${slideshowProduct.id}`}
                  src={slideshowProduct.videoUrl}
                  autoPlay
                  muted
                  playsInline
                  onEnded={() => {
                    if (videoFallbackRef.current) clearTimeout(videoFallbackRef.current);
                    console.log(`Video ended: ${slideshowProduct.id}, advancing...`);
                    advanceSlideshow();
                  }}
                  onError={() => {
                    console.log(`Video error: ${slideshowProduct.id}, skipping...`);
                    advanceSlideshow();
                  }}
                  className="w-full aspect-video object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    Solar Life Energy
                  </span>
                  <h2 className="text-xl font-black text-white leading-tight">
                    {t(slideshowProduct.nameKey)}
                  </h2>
                </div>
              </div>
            ) : (
              <>
                <div className="relative p-6 flex items-center gap-5 gradient-solar">
                  <span className="text-7xl drop-shadow-lg">{slideshowProduct.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                      Solar Life Energy
                    </span>
                    <h2 className="text-2xl font-black text-white leading-tight">
                      {t(slideshowProduct.nameKey)}
                    </h2>
                    <p className="text-sm text-white/80 mt-1 line-clamp-2">
                      {t(slideshowProduct.descKey)}
                    </p>
                  </div>
                  <Sparkles className="w-6 h-6 text-white/60 animate-pulse" />
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-white/20">
                  <motion.div
                    key={`bar-${slideshowIndex}`}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: SLIDESHOW_INTERVAL / 1000, ease: 'linear' }}
                    className="h-full bg-white/60"
                  />
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4">
        {/* Video de abertura */}
        {SOLAR_PRODUCTS[0]?.videoUrl && (
          <div className="mb-4 rounded-2xl overflow-hidden shadow-lg border border-border">
            <video
              src={SOLAR_PRODUCTS[0].videoUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="w-full aspect-video object-cover bg-black"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {SOLAR_PRODUCTS.map((product, i) => (
            <motion.button
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleProductClick(product)}
              className={`relative rounded-2xl border overflow-hidden text-left transition-all shadow-card hover:shadow-lg ${
                product.highlight
                  ? 'border-solar-gold/40 bg-gradient-to-br from-card to-solar-gold/5'
                  : product.action === 'open-chat'
                  ? 'border-primary/30 bg-gradient-to-br from-card to-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              {product.highlight && (
                <div className="absolute top-0 left-0 right-0 h-1 gradient-solar" />
              )}
              {product.action === 'open-chat' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
              )}
              {/* Video thumbnail para cards com vídeo */}
              {product.videoUrl && !product.highlight && (
                <div className="relative">
                  <video
                    src={product.videoUrl}
                    muted
                    playsInline
                    autoPlay
                    loop
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-3xl">{product.icon}</span>
                  {product.action === 'open-chat' ? (
                    <MessageCircle className="w-5 h-5 text-primary" />
                  ) : (
                    <span className="text-lg">{product.emoji}</span>
                  )}
                </div>
                <h3 className="font-bold text-sm text-foreground leading-snug mb-1">
                  {t(product.nameKey)}
                </h3>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {t(product.descKey)}
                </p>
                <div className="flex items-center gap-1 mt-3 text-solar-orange">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {product.action === 'open-chat' ? 'Abrir Chat' : 'Ver detalhes'}
                  </span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Audio Control Panel */}
        <div className="mt-5">
          <AudioPanel />
        </div>

        {/* Client Lead Capture */}
        <div className="mt-5 rounded-2xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-solar-gold" />
            {t('showcase.clientSection')}
          </h3>

          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t('showcase.clientNamePlaceholder')}
              className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-solar-gold/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              type="tel"
              value={clientWhatsapp}
              onChange={(e) => setClientWhatsapp(e.target.value)}
              placeholder={t('showcase.clientWhatsappPlaceholder')}
              className="flex-1 h-11 px-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-solar-gold/30"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={saved}
            className="w-full h-14 rounded-xl gradient-solar text-white flex items-center justify-center gap-2 font-bold text-base shadow-lg disabled:opacity-60"
          >
            {saved ? <CheckCircle className="w-6 h-6" /> : <Save className="w-6 h-6" />}
            {saved ? t('showcase.savedSuccess') : t('showcase.saveInteraction')}
          </motion.button>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground mt-4 mb-2">
          Solar Life Energy • AlphaBot Connect v3.0.1 • Iascom
        </p>
      </div>

      {/* Product Detail Modal */}
      <SolarProductModal
        product={selectedProduct ?? SOLAR_PRODUCTS[0]}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
};

export default ProductShowcase;
