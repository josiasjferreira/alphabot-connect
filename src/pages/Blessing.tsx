import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, Hand, Heart, Star, PartyPopper } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';

interface AnimationPreset {
  id: string;
  icon: typeof Sparkles;
  labelKey: string;
  color: string;
  emoji: string;
  phrase?: string;
}

const presets: AnimationPreset[] = [
  { id: 'wave', icon: Hand, labelKey: 'blessing.presets.wave', color: 'from-primary to-warning', emoji: '👋' },
  { id: 'welcome', icon: Sparkles, labelKey: 'blessing.presets.welcome', color: 'from-secondary to-primary', emoji: '✨', phrase: 'blessing.presets.welcomePhrase' },
  { id: 'love', icon: Heart, labelKey: 'blessing.presets.love', color: 'from-destructive to-primary', emoji: '❤️' },
  { id: 'celebrate', icon: PartyPopper, labelKey: 'blessing.presets.celebrate', color: 'from-success to-warning', emoji: '🎉' },
  { id: 'star', icon: Star, labelKey: 'blessing.presets.star', color: 'from-warning to-primary', emoji: '⭐' },
];

const Blessing = () => {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; time: Date }[]>([]);

  const playAnimation = (id: string) => {
    setPlaying(id);
    setHistory(prev => [{ id, time: new Date() }, ...prev].slice(0, 10));
    setTimeout(() => setPlaying(null), 3000);
  };

  const activePreset = presets.find(p => p.id === playing);

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('blessing.title')} />
      <div className="flex-1 p-4 space-y-4">
        {/* Preview area */}
        <div className="w-full aspect-video rounded-2xl bg-card border border-border shadow-card flex items-center justify-center overflow-hidden relative">
          <AnimatePresence>
            {activePreset ? (
              <motion.div
                key={playing}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-7xl mb-2"
                >
                  {activePreset.emoji}
                </motion.div>
                <p className="text-sm font-semibold text-foreground">{t(activePreset.labelKey)}</p>
                {activePreset.phrase && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-xs text-muted-foreground mt-1"
                  >
                    {t(activePreset.phrase)}
                  </motion.p>
                )}
              </motion.div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Sparkles className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">{t('blessing.selectAnimation')}</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Preset grid */}
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <motion.button
              key={preset.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => playAnimation(preset.id)}
              disabled={!!playing}
              className={`p-4 rounded-xl bg-card border border-border shadow-card flex flex-col items-center gap-2 disabled:opacity-50 ${
                playing === preset.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${preset.color} flex items-center justify-center`}>
                <preset.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xs font-medium text-foreground">{t(preset.labelKey)}</span>
            </motion.button>
          ))}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => playAnimation('custom')}
            disabled={!!playing}
            className="p-4 rounded-xl bg-card border border-dashed border-border shadow-card flex flex-col items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">{t('blessing.custom')}</span>
          </motion.button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">{t('blessing.history')}</p>
            <div className="space-y-1">
              {history.map((h, i) => {
                const p = presets.find(pr => pr.id === h.id);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{p?.emoji || '🎭'}</span>
                    <span>{p ? t(p.labelKey) : t('blessing.custom')}</span>
                    <span className="ml-auto">{h.time.toLocaleTimeString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Blessing;
