import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Download, CheckCircle, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const OtaUpdate = () => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [installed, setInstalled] = useState(false);

  const checkForUpdates = () => {
    setChecking(true);
    setUpdateAvailable(false);
    setInstalled(false);
    setTimeout(() => {
      setChecking(false);
      setUpdateAvailable(true);
    }, 2000);
  };

  const startDownload = () => {
    setDownloading(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloading(false);
          setInstalled(true);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('ota.title')} />
      <div className="flex-1 p-4 space-y-4">
        {/* Current version */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">{t('ota.currentVersion')}</span>
          </div>
          <p className="text-lg font-bold text-foreground">v1.0.4</p>
          <p className="text-xs text-muted-foreground mt-1">{t('ota.firmwareDate')}: 2025-02-15</p>
        </div>

        {/* Update status */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-card space-y-3">
          {!updateAvailable && !installed && (
            <Button onClick={checkForUpdates} disabled={checking} className="w-full gap-2">
              {checking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {checking ? t('ota.checking') : t('ota.checkUpdates')}
            </Button>
          )}

          {updateAvailable && !downloading && !installed && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <span className="text-sm font-semibold text-foreground">{t('ota.updateAvailable')}</span>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-bold text-foreground">v1.1.0</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <li>• {t('ota.changelog.item1')}</li>
                  <li>• {t('ota.changelog.item2')}</li>
                  <li>• {t('ota.changelog.item3')}</li>
                </ul>
              </div>
              <Button onClick={startDownload} className="w-full gap-2">
                <Download className="w-4 h-4" /> {t('ota.downloadInstall')}
              </Button>
            </motion.div>
          )}

          {downloading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t('ota.downloading')}</p>
              <Progress value={Math.min(progress, 100)} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">{Math.min(Math.round(progress), 100)}%</p>
            </motion.div>
          )}

          {installed && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">{t('ota.installed')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('ota.restartRequired')}</p>
              <Button variant="outline" className="mt-3" onClick={() => { setInstalled(false); setUpdateAvailable(false); }}>
                {t('ota.restartNow')}
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtaUpdate;
