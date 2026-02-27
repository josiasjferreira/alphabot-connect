import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Bot, Sparkles, Play, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SolarProduct } from '@/data/solarProducts';
import { useMQTT } from '@/hooks/useMQTT';
import { robotMultimedia } from '@/services/robotMultimediaService';

interface Props {
  product: SolarProduct;
  open: boolean;
  onClose: () => void;
}

const SolarProductModal = ({ product, open, onClose }: Props) => {
  const { t } = useTranslation();
  const { publish, isConnected } = useMQTT();

  const handlePresentOnRobot = useCallback(() => {
    // TODO: Quando placa Android estiver integrada, orquestrar apresentação completa
    // Publica no MQTT para que qualquer sistema de apresentação possa reagir
    if (isConnected) {
      publish('solar-life/product-selected', {
        productId: product.id,
        productName: t(product.nameKey),
        timestamp: Date.now(),
        action: 'present',
      });
    }

    // Tenta via serviço multimídia da placa Android (192.168.99.10)
    robotMultimedia.presentProduct(
      product.id,
      t(product.nameKey),
      t(product.descKey),
    );
  }, [product, isConnected, publish, t]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero */}
          {product.videoUrl ? (
            <div className="relative rounded-t-3xl overflow-hidden">
              <video
                key={product.videoUrl}
                src={product.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                className="w-full aspect-video object-cover"
              />
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/30 backdrop-blur flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                  Solar Life Energy
                </span>
                <h2 className="text-2xl font-black text-white leading-tight">
                  {t(product.nameKey)}
                </h2>
              </div>
            </div>
          ) : (
            <div className="relative h-48 gradient-solar flex items-center justify-center rounded-t-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
              <span className="text-8xl relative z-10 drop-shadow-lg">{product.icon}</span>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/30 backdrop-blur flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-5 right-5 z-10">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                  Solar Life Energy
                </span>
                <h2 className="text-2xl font-black text-white leading-tight">
                  {t(product.nameKey)}
                </h2>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(product.descKey)}
            </p>

            {/* Benefits */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-solar-gold mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Benefícios
              </h3>
              <ul className="space-y-2">
                {product.benefits.map((b, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-2 text-sm text-foreground"
                  >
                    <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full gradient-solar-green flex items-center justify-center text-[10px] text-white font-bold">
                      ✓
                    </span>
                    {b}
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePresentOnRobot}
                className="w-full h-14 rounded-2xl gradient-solar text-white flex items-center justify-center gap-2 font-bold text-base shadow-lg"
              >
                <Bot className="w-5 h-5" />
                Apresentar no Robô
                {/* TODO: Indicar se placa Android está online */}
              </motion.button>

              <button
                onClick={onClose}
                className="w-full h-11 rounded-2xl bg-muted text-muted-foreground text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SolarProductModal;
