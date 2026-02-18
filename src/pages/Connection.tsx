import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Loader2, CloudOff, KeyRound, BookOpen, ChevronDown, Bluetooth, BluetoothSearching, BluetoothConnected, RotateCw, Lock, LockOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBluetoothSerial } from '@/hooks/useBluetoothSerial';
import { unlockAudio } from '@/lib/audioEffects';
import alphaIcon from '/icon-512.png';

const Connection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { ip, port, authToken, connectionStatus, bluetoothStatus, bluetoothDevice, error, setConnection, setOfflineMode } = useRobotStore();
  const { connect } = useWebSocket();
  const { scanAndConnect, reconnectLastDevice, savedDevice } = useBluetoothSerial();
  const [localIp, setLocalIp] = useState(ip);
  const [localPort, setLocalPort] = useState(port);
  const [localToken, setLocalToken] = useState(authToken);
  const [showGuide, setShowGuide] = useState(false);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<'wifi' | 'bluetooth'>('wifi');

  // Unlock audio on first user interaction (required for Android WebView)
  useEffect(() => {
    const handler = () => { unlockAudio(); document.removeEventListener('click', handler); };
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, []);

  const isValidIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(localIp);
  const isValidPort = /^\d{1,5}$/.test(localPort) && parseInt(localPort) > 0 && parseInt(localPort) <= 65535;

  const isPrivateIp = (ip: string) =>
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.0\.0\.1|localhost)/.test(ip);

  const handleConnect = () => {
    if (!isValidIp || !isValidPort) return;

    if (!isPrivateIp(localIp)) {
      const confirmed = window.confirm(t('connection.externalIpWarning', { ip: localIp }));
      if (!confirmed) return;
    }

    setConnection(localIp, localPort, localToken);
    connect();
    setTimeout(() => navigate('/dashboard'), 800);
  };

  const handleBluetoothConnect = async () => {
    const success = await scanAndConnect();
    if (success) {
      setTimeout(() => navigate('/dashboard'), 800);
    }
  };

  const handleBluetoothReconnect = async () => {
    const success = await reconnectLastDevice();
    if (success) {
      setTimeout(() => navigate('/dashboard'), 800);
    }
  };

  const handleOffline = () => {
    setOfflineMode(true);
    navigate('/dashboard');
  };

  const isConnecting = connectionStatus === 'connecting';
  const isBtScanning = bluetoothStatus === 'scanning';

  const statusKey = connectionStatus === 'connected' ? 'connected'
    : connectionStatus === 'connecting' ? 'connecting'
    : connectionStatus === 'error' ? 'error' : 'disconnected';

  const btStatusColor = bluetoothStatus === 'connected' ? 'text-success' :
    bluetoothStatus === 'paired' ? 'text-primary' :
    bluetoothStatus === 'scanning' ? 'text-warning' :
    bluetoothStatus === 'error' ? 'text-destructive' : 'text-muted-foreground';

  const BtIcon = bluetoothStatus === 'connected' ? BluetoothConnected :
    bluetoothStatus === 'scanning' ? BluetoothSearching : Bluetooth;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center mb-8"
      >
        <motion.img
          src={alphaIcon}
          alt="AlphaBot"
          className="w-24 h-24 rounded-2xl mb-4"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <h1 className="text-2xl font-bold text-foreground">{t('connection.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('connection.subtitle')}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-sm space-y-4"
      >
        {/* Connection Mode Toggle */}
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          <button
            onClick={() => setConnectionMode('wifi')}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              connectionMode === 'wifi' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Wifi className="w-4 h-4" /> WiFi
          </button>
          <button
            onClick={() => setConnectionMode('bluetooth')}
            className={`flex-1 h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              connectionMode === 'bluetooth' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            }`}
          >
            <Bluetooth className="w-4 h-4" /> Bluetooth
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            connectionMode === 'wifi'
              ? (connectionStatus === 'connected' ? 'bg-success' :
                 connectionStatus === 'connecting' ? 'bg-warning animate-pulse' :
                 connectionStatus === 'error' ? 'bg-destructive' : 'bg-muted-foreground')
              : (bluetoothStatus === 'connected' ? 'bg-success' :
                 bluetoothStatus === 'paired' ? 'bg-primary' :
                 bluetoothStatus === 'scanning' ? 'bg-warning animate-pulse' :
                 bluetoothStatus === 'error' ? 'bg-destructive' : 'bg-muted-foreground')
          }`} />
          <span className="text-sm text-muted-foreground font-medium">
            {connectionMode === 'wifi'
              ? t(`connection.status.${statusKey}`)
              : bluetoothStatus === 'paired'
                ? `${t('connection.bluetooth.paired')}: ${bluetoothDevice}`
                : bluetoothStatus === 'connected'
                  ? `${t('connection.bluetooth.connected')}: ${bluetoothDevice}`
                  : t(`connection.bluetooth.${bluetoothStatus}`)}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {connectionMode === 'wifi' ? (
            <motion.div key="wifi" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('connection.ipLabel')}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={localIp}
                    onChange={(e) => setLocalIp(e.target.value)}
                    placeholder={t('connection.ipPlaceholder')}
                    className={`w-full h-14 px-4 pr-12 rounded-xl bg-card border-2 text-foreground text-base font-medium
                      focus:outline-none focus:ring-2 focus:ring-primary/30
                      ${isValidIp || !localIp ? 'border-border' : 'border-destructive'}`}
                  />
                  {localIp && isValidIp && (
                    <div className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 ${isPrivateIp(localIp) ? 'text-warning' : 'text-success'}`}
                      title={isPrivateIp(localIp) ? 'ws:// (unencrypted)' : 'wss:// (encrypted)'}
                    >
                      {isPrivateIp(localIp) ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      <span className="text-[10px] font-bold">{isPrivateIp(localIp) ? 'WS' : 'WSS'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('connection.portLabel')}</label>
                <input
                  type="text"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  placeholder={t('connection.portPlaceholder')}
                  className={`w-full h-14 px-4 rounded-xl bg-card border-2 text-foreground text-base font-medium
                    focus:outline-none focus:ring-2 focus:ring-primary/30
                    ${isValidPort || !localPort ? 'border-border' : 'border-destructive'}`}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  <span className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> {t('connection.tokenLabel')}</span>
                </label>
                <input
                  type="password"
                  value={localToken}
                  onChange={(e) => setLocalToken(e.target.value)}
                  placeholder={t('connection.tokenPlaceholder')}
                  className="w-full h-14 px-4 rounded-xl bg-card border-2 border-border text-foreground text-base font-medium
                    focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleConnect}
                disabled={!isValidIp || !isValidPort || isConnecting}
                className="w-full min-h-[56px] rounded-xl gradient-primary text-primary-foreground font-bold text-base
                  shadow-button flex items-center justify-center gap-3
                  disabled:opacity-50 disabled:shadow-none active:shadow-none transition-shadow"
              >
                {isConnecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wifi className="w-5 h-5" />
                )}
                {isConnecting ? t('connection.connectingButton') : t('connection.connectButton')}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="bluetooth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {/* Bluetooth Device Info */}
              <div className="bg-card rounded-2xl border border-border p-4 text-center">
                <BtIcon className={`w-12 h-12 mx-auto mb-2 ${btStatusColor} ${isBtScanning ? 'animate-pulse' : ''}`} />
                <p className="text-sm font-semibold text-foreground">
                  {bluetoothDevice || t('connection.bluetooth.noDevice')}
                </p>
                <p className={`text-xs font-medium mt-1 ${btStatusColor}`}>
                  {bluetoothStatus === 'paired' ? t('connection.bluetooth.paired')
                    : bluetoothStatus === 'connected' ? t('connection.bluetooth.connected')
                    : bluetoothStatus === 'scanning' ? t('connection.bluetooth.scanning')
                    : bluetoothStatus === 'error' ? t('connection.bluetooth.error')
                    : t('connection.bluetooth.disconnected')}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleBluetoothConnect}
                disabled={isBtScanning}
                className="w-full min-h-[56px] rounded-xl bg-secondary text-secondary-foreground font-bold text-base
                  shadow-button flex items-center justify-center gap-3
                  disabled:opacity-50 active:shadow-none transition-shadow"
              >
                {isBtScanning ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Bluetooth className="w-5 h-5" />
                )}
                {isBtScanning ? t('connection.bluetooth.scanning') : t('connection.bluetooth.connect')}
              </motion.button>

              {/* Quick Reconnect to last device */}
              {savedDevice && bluetoothStatus === 'disconnected' && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBluetoothReconnect}
                  disabled={isBtScanning}
                  className="w-full min-h-[48px] rounded-xl border-2 border-primary/40 bg-primary/5 text-primary font-semibold text-sm
                    flex items-center justify-center gap-2
                    disabled:opacity-50 active:bg-primary/10 transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                  {t('connection.bluetooth.reconnectLast', { name: savedDevice.name })}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleOffline}
          className="w-full min-h-[48px] rounded-xl border-2 border-border bg-card text-muted-foreground font-semibold text-sm
            flex items-center justify-center gap-2 active:bg-muted"
        >
          <CloudOff className="w-4 h-4" />
          {t('connection.offlineButton')}
        </button>

        {/* Guide Toggle */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowGuide(!showGuide)}
          className="w-full min-h-[44px] rounded-xl bg-primary/10 text-primary font-semibold text-sm
            flex items-center justify-center gap-2 mt-2"
        >
          <BookOpen className="w-4 h-4" />
          {t('connection.guide.title')}
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showGuide ? 'rotate-180' : ''}`} />
        </motion.button>

        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 mt-2">
                {['step1', 'step2', 'step3', 'step4', 'step5'].map((step) => (
                  <div key={step} className="rounded-xl bg-accent border border-accent-foreground/20 overflow-hidden">
                    <button
                      onClick={() => setOpenStep(openStep === step ? null : step)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left"
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {t(`connection.guide.${step}Title`)}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${openStep === step ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {openStep === step && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed">
                            {t(`connection.guide.${step}Desc`)}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
                <p className="text-xs text-primary/80 text-center py-2 font-medium">
                  {t('connection.guide.tip')}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <p className="text-[10px] text-muted-foreground mt-8 text-center">{t('connection.version')}</p>
    </div>
  );
};

export default Connection;
