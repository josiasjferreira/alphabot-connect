import { useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Volume2, Gauge, Moon, Sun, RotateCcw, Trash2 } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSettingsStore } from '@/store/useSettingsStore';

const Settings = () => {
  const { ip, port, connectionStatus, offlineMode, setConnection, setOfflineMode, clearLogs } = useRobotStore();
  const { connect, disconnect } = useWebSocket();
  const {
    maxSpeed, ttsVolume, ttsRate, darkMode,
    setMaxSpeed, setTtsVolume, setTtsRate, setDarkMode,
  } = useSettingsStore();

  const [localIp, setLocalIp] = useState(ip);
  const [localPort, setLocalPort] = useState(port);

  const handleReconnect = () => {
    disconnect();
    setConnection(localIp, localPort);
    connect();
  };

  const handleToggleDark = (checked: boolean) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle('dark', checked);
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title="Configurações" />

      <div className="p-4 space-y-4">
        {/* Connection */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-5 h-5 text-primary" /> Conexão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Conectado' : 'Desconectado'}
                  {offlineMode && ' (Offline)'}
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">IP DO ROBÔ</Label>
                <input
                  type="text"
                  value={localIp}
                  onChange={(e) => setLocalIp(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-background border-2 border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground">PORTA</Label>
                <input
                  type="text"
                  value={localPort}
                  onChange={(e) => setLocalPort(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-background border-2 border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReconnect}
                  className="flex-1 h-12 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Reconectar
                </button>
                <button
                  onClick={() => { disconnect(); setOfflineMode(!offlineMode); }}
                  className="flex-1 h-12 rounded-xl border-2 border-border bg-card text-muted-foreground font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {offlineMode ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  {offlineMode ? 'Online' : 'Offline'}
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Speed */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="w-5 h-5 text-warning" /> Velocidade Máxima
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Limite de velocidade</span>
                <span className="text-lg font-bold text-foreground">{maxSpeed}%</span>
              </div>
              <Slider
                value={[maxSpeed]}
                onValueChange={([v]) => setMaxSpeed(v)}
                min={10}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">Limita a velocidade máxima do joystick e comandos de voz.</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Voice */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-secondary" /> Síntese de Voz
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Volume</span>
                  <span className="text-sm font-bold text-foreground">{Math.round(ttsVolume * 100)}%</span>
                </div>
                <Slider
                  value={[ttsVolume * 100]}
                  onValueChange={([v]) => setTtsVolume(v / 100)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Velocidade da fala</span>
                  <span className="text-sm font-bold text-foreground">{ttsRate.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[ttsRate * 100]}
                  onValueChange={([v]) => setTtsRate(v / 100)}
                  min={50}
                  max={200}
                  step={10}
                />
              </div>
              <button
                onClick={() => {
                  const u = new SpeechSynthesisUtterance('Testando síntese de voz do AlphaBot.');
                  u.lang = 'pt-BR';
                  u.volume = ttsVolume;
                  u.rate = ttsRate;
                  speechSynthesis.speak(u);
                }}
                className="w-full h-12 rounded-xl border-2 border-border bg-card text-foreground font-semibold text-sm flex items-center justify-center gap-2 active:bg-muted"
              >
                <Volume2 className="w-4 h-4" /> Testar Voz
              </button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Theme */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {darkMode ? <Moon className="w-5 h-5 text-accent" /> : <Sun className="w-5 h-5 text-warning" />} Aparência
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Modo Escuro</p>
                  <p className="text-xs text-muted-foreground">Ativar tema escuro</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={handleToggleDark} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" /> Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                onClick={clearLogs}
                className="w-full h-12 rounded-xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2 active:bg-destructive/10"
              >
                Limpar Logs
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('alphabot-chat-history');
                  window.location.reload();
                }}
                className="w-full h-12 rounded-xl border-2 border-destructive/30 text-destructive font-semibold text-sm flex items-center justify-center gap-2 active:bg-destructive/10"
              >
                Limpar Histórico de Chat
              </button>
            </CardContent>
          </Card>
        </motion.div>

        <p className="text-xs text-center text-muted-foreground py-4">AlphaBot Companion v1.0.0 • Solar Life Energy</p>
      </div>
    </div>
  );
};

export default Settings;
