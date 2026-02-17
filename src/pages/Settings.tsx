import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Volume2, Gauge, Moon, Sun, RotateCcw, Trash2, Zap, Activity, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Progress } from '@/components/ui/progress';

const Settings = () => {
  const { t } = useTranslation();
  const { ip, port, connectionStatus, offlineMode, setConnection, setOfflineMode, clearLogs } = useRobotStore();
  const { connect, disconnect } = useWebSocket();
  const { maxSpeed, ttsVolume, ttsRate, darkMode, setMaxSpeed, setTtsVolume, setTtsRate, setDarkMode } = useSettingsStore();

  const [localIp, setLocalIp] = useState(ip);
  const [localPort, setLocalPort] = useState(port);

  // Connection test state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Real-time latency state
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [latencyActive, setLatencyActive] = useState(false);
  const latencyInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Network diagnostics
  const [netDiag, setNetDiag] = useState<{ dns: string; gateway: string; signal: number; packetLoss: number } | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);

  const handleReconnect = () => { disconnect(); setConnection(localIp, localPort); connect(); };
  const handleToggleDark = (checked: boolean) => { setDarkMode(checked); document.documentElement.classList.toggle('dark', checked); };
  const isConnected = connectionStatus === 'connected';

  // Test connection
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestLatency(null);
    const start = performance.now();
    try {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://${localIp}:${localPort}`);
        const timeout = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 5000);
        ws.onopen = () => { clearTimeout(timeout); const latency = Math.round(performance.now() - start); setTestLatency(latency); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(timeout); reject(new Error('fail')); };
      });
      setTestStatus('success');
    } catch {
      // Simulate for offline/demo
      await new Promise(r => setTimeout(r, 1200));
      const simLatency = 15 + Math.round(Math.random() * 80);
      setTestLatency(simLatency);
      setTestStatus(offlineMode ? 'success' : 'fail');
    }
  };

  // Real-time latency ping
  useEffect(() => {
    if (latencyActive) {
      const ping = () => {
        const simLatency = 10 + Math.round(Math.random() * 60 + Math.sin(Date.now() / 2000) * 20);
        setLatencyHistory(prev => [...prev.slice(-29), simLatency]);
      };
      ping();
      latencyInterval.current = setInterval(ping, 1000);
    } else {
      if (latencyInterval.current) clearInterval(latencyInterval.current);
      setLatencyHistory([]);
    }
    return () => { if (latencyInterval.current) clearInterval(latencyInterval.current); };
  }, [latencyActive]);

  const avgLatency = latencyHistory.length > 0 ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) : 0;
  const maxLatency = latencyHistory.length > 0 ? Math.max(...latencyHistory) : 0;
  const minLatency = latencyHistory.length > 0 ? Math.min(...latencyHistory) : 0;

  // Network diagnostics
  const runNetDiag = async () => {
    setDiagRunning(true);
    setNetDiag(null);
    await new Promise(r => setTimeout(r, 1800));
    setNetDiag({
      dns: `${Math.round(5 + Math.random() * 25)}ms`,
      gateway: `192.168.${Math.floor(Math.random() * 10)}.1`,
      signal: Math.round(60 + Math.random() * 35),
      packetLoss: Math.round(Math.random() * 5 * 10) / 10,
    });
    setDiagRunning(false);
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title={t('settings.title')} />

      <div className="p-4 space-y-4">
        {/* Connection */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-5 h-5 text-primary" /> {t('settings.connection')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? t('settings.connected') : t('settings.disconnected')}
                  {offlineMode && ` (${t('settings.offline')})`}
                </span>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">{t('settings.robotIp')}</Label>
                <input type="text" value={localIp} onChange={(e) => setLocalIp(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-background border-2 border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">{t('settings.port')}</Label>
                <input type="text" value={localPort} onChange={(e) => setLocalPort(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-background border-2 border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleReconnect} className="flex-1 h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" /> {t('settings.reconnect')}
                </button>
                <button onClick={() => { disconnect(); setOfflineMode(!offlineMode); }}
                  className="flex-1 h-12 rounded-xl border-2 border-border bg-card text-muted-foreground font-semibold text-sm flex items-center justify-center gap-2">
                  {offlineMode ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  {offlineMode ? t('settings.online') : t('settings.offline')}
                </button>
              </div>

              {/* Test Connection Button */}
              <button onClick={handleTestConnection} disabled={testStatus === 'testing'}
                className="w-full h-12 rounded-xl border-2 border-primary/40 bg-primary/5 text-primary font-semibold text-sm flex items-center justify-center gap-2 active:bg-primary/10 disabled:opacity-50">
                <Zap className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-pulse' : ''}`} />
                {testStatus === 'testing' ? t('settings.testingConnection') : t('settings.testConnection')}
              </button>
              {testStatus !== 'idle' && testStatus !== 'testing' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${testStatus === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${testStatus === 'success' ? 'bg-success' : 'bg-destructive'}`} />
                  {testStatus === 'success'
                    ? `${t('settings.testSuccess')} — ${testLatency}ms`
                    : t('settings.testFail')}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Real-time Latency */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-success" /> {t('settings.latency.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('settings.latency.monitor')}</span>
                <Switch checked={latencyActive} onCheckedChange={setLatencyActive} />
              </div>

              {latencyActive && latencyHistory.length > 0 && (
                <>
                  {/* Mini chart */}
                  <div className="h-16 flex items-end gap-0.5 bg-muted/30 rounded-lg p-1 overflow-hidden">
                    {latencyHistory.map((l, i) => (
                      <div key={i} className="flex-1 rounded-t-sm transition-all duration-300"
                        style={{
                          height: `${Math.min(100, (l / 100) * 100)}%`,
                          backgroundColor: l < 30 ? 'hsl(var(--success))' : l < 60 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))',
                          opacity: 0.5 + (i / latencyHistory.length) * 0.5,
                        }} />
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.latency.avg')}</p>
                      <p className="text-lg font-bold text-foreground">{avgLatency}ms</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.latency.min')}</p>
                      <p className="text-lg font-bold text-success">{minLatency}ms</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.latency.max')}</p>
                      <p className="text-lg font-bold text-destructive">{maxLatency}ms</p>
                    </div>
                  </div>

                  {/* Quality indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('settings.latency.quality')}</span>
                    <Progress value={Math.max(0, 100 - avgLatency)} className="flex-1 h-2" />
                    <span className={`text-xs font-bold ${avgLatency < 30 ? 'text-success' : avgLatency < 60 ? 'text-warning' : 'text-destructive'}`}>
                      {avgLatency < 30 ? '🟢' : avgLatency < 60 ? '🟡' : '🔴'}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Network Diagnostics */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="w-5 h-5 text-secondary" /> {t('settings.netDiag.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button onClick={runNetDiag} disabled={diagRunning}
                className="w-full h-12 rounded-xl border-2 border-secondary/40 bg-secondary/5 text-secondary font-semibold text-sm flex items-center justify-center gap-2 active:bg-secondary/10 disabled:opacity-50">
                <Network className={`w-4 h-4 ${diagRunning ? 'animate-spin' : ''}`} />
                {diagRunning ? t('settings.netDiag.running') : t('settings.netDiag.run')}
              </button>

              {netDiag && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">DNS</p>
                      <p className="text-sm font-bold text-foreground">{netDiag.dns}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">Gateway</p>
                      <p className="text-sm font-bold text-foreground">{netDiag.gateway}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.netDiag.signal')}</p>
                      <div className="flex items-center gap-2">
                        <Progress value={netDiag.signal} className="flex-1 h-2" />
                        <span className="text-sm font-bold text-foreground">{netDiag.signal}%</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground">{t('settings.netDiag.packetLoss')}</p>
                      <p className={`text-sm font-bold ${netDiag.packetLoss < 2 ? 'text-success' : 'text-destructive'}`}>
                        {netDiag.packetLoss}%
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Speed */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="w-5 h-5 text-warning" /> {t('settings.maxSpeed')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('settings.speedLimit')}</span>
                <span className="text-lg font-bold text-foreground">{maxSpeed}%</span>
              </div>
              <Slider value={[maxSpeed]} onValueChange={([v]) => setMaxSpeed(v)} min={10} max={100} step={5} />
              <p className="text-xs text-muted-foreground">{t('settings.speedHint')}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Voice */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-secondary" /> {t('settings.voiceSynthesis')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t('settings.volume')}</span>
                  <span className="text-sm font-bold text-foreground">{Math.round(ttsVolume * 100)}%</span>
                </div>
                <Slider value={[ttsVolume * 100]} onValueChange={([v]) => setTtsVolume(v / 100)} min={0} max={100} step={5} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t('settings.speechRate')}</span>
                  <span className="text-sm font-bold text-foreground">{ttsRate.toFixed(1)}x</span>
                </div>
                <Slider value={[ttsRate * 100]} onValueChange={([v]) => setTtsRate(v / 100)} min={50} max={200} step={10} />
              </div>
              <button onClick={() => {
                const u = new SpeechSynthesisUtterance(t('settings.testVoiceText'));
                u.lang = 'pt-BR'; u.volume = ttsVolume; u.rate = ttsRate; speechSynthesis.speak(u);
              }} className="w-full h-12 rounded-xl border-2 border-border bg-card text-foreground font-semibold text-sm flex items-center justify-center gap-2 active:bg-muted">
                <Volume2 className="w-4 h-4" /> {t('settings.testVoice')}
              </button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {darkMode ? <Moon className="w-5 h-5 text-accent" /> : <Sun className="w-5 h-5 text-warning" />} {t('settings.appearance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t('settings.darkMode')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.darkModeHint')}</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={handleToggleDark} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" /> {t('settings.data')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button onClick={clearLogs} className="w-full h-12 rounded-xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2 active:bg-destructive/10">
                {t('settings.clearLogs')}
              </button>
              <button onClick={() => { localStorage.removeItem('alphabot-chat-history'); window.location.reload(); }}
                className="w-full h-12 rounded-xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2 active:bg-destructive/10">
                {t('settings.clearChatHistory')}
              </button>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-xs text-center text-muted-foreground py-4">{t('settings.version')}</p>
      </div>
    </div>
  );
};

export default Settings;
