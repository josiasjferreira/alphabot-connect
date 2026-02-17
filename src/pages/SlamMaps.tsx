import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Map, Upload, Trash2, Check, Clock, Layers } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';

interface SlamMap {
  id: string;
  name: string;
  createdAt: Date;
  pointCount: number;
  active: boolean;
}

const SlamMaps = () => {
  const { t } = useTranslation();
  const [maps, setMaps] = useState<SlamMap[]>([
    { id: '1', name: 'Escritório Principal', createdAt: new Date(Date.now() - 86400000 * 3), pointCount: 1245, active: true },
    { id: '2', name: 'Andar 2', createdAt: new Date(Date.now() - 86400000), pointCount: 890, active: false },
    { id: '3', name: 'Área Externa', createdAt: new Date(), pointCount: 456, active: false },
  ]);
  const [scanning, setScanning] = useState(false);

  const startScan = () => {
    setScanning(true);
    setTimeout(() => {
      setMaps(prev => [...prev, {
        id: Date.now().toString(),
        name: `${t('slam.newScan')} ${prev.length + 1}`,
        createdAt: new Date(),
        pointCount: Math.round(Math.random() * 2000 + 500),
        active: false,
      }]);
      setScanning(false);
    }, 3000);
  };

  const setActive = (id: string) => {
    setMaps(prev => prev.map(m => ({ ...m, active: m.id === id })));
  };

  const deleteMap = (id: string) => {
    setMaps(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('slam.title')} />
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('slam.mapCount', { count: maps.length })}</span>
          </div>
          <Button onClick={startScan} disabled={scanning} className="gap-1">
            {scanning ? <span className="animate-spin">⏳</span> : <Upload className="w-4 h-4" />}
            {scanning ? t('slam.scanning') : t('slam.newScanBtn')}
          </Button>
        </div>

        <div className="space-y-2">
          {maps.map((map, i) => (
            <motion.div
              key={map.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-3 rounded-xl border shadow-card transition-colors ${
                map.active ? 'bg-primary/10 border-primary' : 'bg-card border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <Map className={`w-5 h-5 ${map.active ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{map.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{map.createdAt.toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{map.pointCount} {t('slam.points')}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!map.active && (
                    <Button size="sm" variant="outline" onClick={() => setActive(map.id)} className="gap-1">
                      <Check className="w-3 h-3" /> {t('slam.activate')}
                    </Button>
                  )}
                  {map.active && (
                    <span className="text-xs font-bold text-primary px-2 py-1">{t('slam.activeLabel')}</span>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteMap(map.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SlamMaps;
