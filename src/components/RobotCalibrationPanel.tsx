import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff, Play, Square, RotateCcw, ChevronLeft, CheckCircle2,
  XCircle, Loader2, Download, Upload, Info, ChevronDown, ChevronUp, Radio, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ROBOT_WIFI_NETWORKS, isHttpsContext, isPWA } from '@/services/RobotWiFiConnection';
import { RobotMQTTClient, type MQTTMessage } from '@/services/RobotMQTTClient';
import type { CalibrationProgress, CalibrationData } from '@/services/bluetoothCalibrationBridge';
import { ALL_SENSORS, type SensorId } from '@/services/bluetoothCalibrationBridge';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';

const SENSOR_META: Record<SensorId, { label: string; icon: string; description: string }> = {
  imu: { label: 'IMU', icon: '🔄', description: 'Acelerômetro + Giroscópio' },
  magnetometer: { label: 'Magnetômetro', icon: '🧭', description: 'Bússola digital' },
  odometer: { label: 'Odômetro', icon: '📏', description: 'Medição de distância' },
  lidar: { label: 'LiDAR', icon: '📡', description: 'Sensor laser' },
  camera: { label: 'Câmera', icon: '📷', description: 'Calibração de lente' },
  battery: { label: 'Bateria', icon: '🔋', description: 'Tensão e carga' },
  temperature: { label: 'Temperatura', icon: '🌡️', description: 'Sensor térmico' },
};

const getSensorStatus = (sensorId: string, currentSensor?: string): 'idle' | 'active' | 'complete' => {
  if (!currentSensor) return 'idle';
  const curIdx = ALL_SENSORS.indexOf(currentSensor as SensorId);
  const thisIdx = ALL_SENSORS.indexOf(sensorId as SensorId);
  if (thisIdx < curIdx) return 'complete';
  if (thisIdx === curIdx) return 'active';
  return 'idle';
};

const RobotCalibrationPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const mqttConfig = useMQTTConfigStore();
  const mqttRef = useRef<RobotMQTTClient | null>(null);

  const [phase, setPhase] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectedBroker, setConnectedBroker] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [selectedSensors, setSelectedSensors] = useState<SensorId[]>([...ALL_SENSORS]);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [progress, setProgress] = useState<CalibrationProgress | null>(null);
  const [calibData, setCalibData] = useState<CalibrationData | null>(null);
  const [mqttMessages, setMqttMessages] = useState<MQTTMessage[]>([]);

  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showMqttPanel, setShowMqttPanel] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showPwaWarning, setShowPwaWarning] = useState(() => isHttpsContext() && !isPWA());

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  // Cleanup
  useEffect(() => () => { mqttRef.current?.disconnect(); }, []);

  // ─── MQTT Connection ───

  const handleScan = async () => {
    setPhase('connecting');
    setError(null);
    addLog('Conectando ao broker MQTT do robô...');

    const brokerUrl = mqttConfig.activeBroker;
    addLog(`Broker: ${brokerUrl} (serial: ${mqttConfig.robotSerial})`);

    try {
      const client = new RobotMQTTClient();

      await client.connect(brokerUrl, {
        onConnect: () => {
          addLog('✅ MQTT conectado!');
          setPhase('connected');
          setConnectedBroker(brokerUrl);
          setShowSuccessDialog(true);
          toast({ title: '✅ MQTT Conectado!', description: `Broker: ${brokerUrl}` });
          // Send ping to discover robot
          setTimeout(() => client.ping(), 800);
        },

        onMessage: (topic, payload) => {
          const ts = new Date().toLocaleTimeString();
          addLog(`📨 [${topic}]: ${JSON.stringify(payload).slice(0, 60)}`);
          setMqttMessages(prev => [{ topic, payload, ts }, ...prev].slice(0, 50));

          // Handle calibration topics
          if (typeof payload === 'object' && payload !== null) {
            const p = payload as Record<string, any>;
            if (topic.includes('/calibration/progress')) {
              const prog: CalibrationProgress = {
                progress: p.progress ?? 0,
                currentSensor: p.sensor ?? p.currentSensor ?? '',
                message: p.message ?? `Calibrando ${p.sensor ?? ''}...`,
              };
              setProgress(prog);
              setIsCalibrating(prog.progress > 0 && prog.progress < 100);
            }
            if (topic.includes('/calibration/complete')) {
              setIsCalibrating(false);
              setProgress(null);
              setCalibData(p as unknown as CalibrationData);
              toast({ title: '✅ Calibração Concluída!' });
              addLog('Calibração completa!');
            }
          }
        },

        onError: (err) => {
          addLog(`❌ Erro MQTT: ${err.message}`);
          setError(`Erro MQTT: ${err.message}`);
          setPhase('disconnected');
        },

        onClose: () => {
          if (phase === 'connected') {
            addLog('🔌 Conexão MQTT perdida');
            setPhase('disconnected');
            setIsCalibrating(false);
            toast({ title: '🔴 MQTT Desconectado', variant: 'destructive' });
          }
        },
      });

      mqttRef.current?.disconnect();
      mqttRef.current = client;

    } catch (err: any) {
      setPhase('disconnected');
      setError(err.message);
      addLog(`Falha: ${err.message}`);
      toast({ title: '❌ Falha na conexão MQTT', description: err.message, variant: 'destructive' });
    }
  };

  const handleDisconnect = () => {
    mqttRef.current?.disconnect();
    mqttRef.current = null;
    setPhase('disconnected');
    setConnectedBroker('');
    setProgress(null);
    setIsCalibrating(false);
    setCalibData(null);
    addLog('Desconectado manualmente');
  };

  // ─── Calibration actions ───

  const handleStart = () => {
    if (!mqttRef.current?.isConnected) return;
    setError(null);
    setCalibData(null);
    mqttRef.current.startCalibration(selectedSensors);
    setIsCalibrating(true);
    addLog(`Calibração iniciada via MQTT: ${selectedSensors.join(', ')}`);
    toast({ title: '🚀 Calibração Iniciada', description: 'Aguardando resposta do robô via MQTT...' });
  };

  const handleStop = () => {
    if (!mqttRef.current?.isConnected) return;
    mqttRef.current.stopCalibration();
    setIsCalibrating(false);
    addLog('Calibração interrompida via MQTT');
  };

  const handleReset = () => {
    if (!mqttRef.current?.isConnected) return;
    mqttRef.current.resetCalibration();
    setCalibData(null);
    setProgress(null);
    addLog('Calibração resetada via MQTT');
    toast({ title: '🔄 Reset enviado' });
  };

  const handleExport = () => {
    if (!calibData) return;
    const blob = new Blob([JSON.stringify(calibData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `calibration-mqtt-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    addLog('Dados exportados');
    toast({ title: '📦 Exportado!' });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as CalibrationData;
        setCalibData(data);
        addLog('Dados importados localmente');
        toast({ title: '📥 Importado!' });
      } catch (err: any) { setError(err.message); addLog(`Importação falhou: ${err.message}`); }
    };
    input.click();
  };

  const toggleSensor = (id: SensorId) => {
    setSelectedSensors(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // ─── Render ───

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-muted active:bg-muted/80">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">📡 Calibração MQTT</h1>
            <p className="text-xs text-muted-foreground">CSJBot • {mqttConfig.robotSerial} • Protocolo Nativo</p>
          </div>
          <button onClick={() => navigate('/mqtt-config')} className="p-2 rounded-xl hover:bg-muted active:bg-muted/80" title="Configurar MQTT">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className={`w-3 h-3 rounded-full transition-colors ${phase === 'connected' ? 'bg-success animate-pulse' : phase === 'connecting' ? 'bg-warning animate-pulse' : 'bg-muted-foreground'}`} />
        </div>
      </div>

      {/* Success Dialog */}
      <AnimatePresence>
        {showSuccessDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-6 text-center space-y-4"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
              <h2 className="text-xl font-bold text-foreground">🎉 Parabéns!!</h2>
              <p className="text-sm text-foreground font-medium">Conectado ao Robô via MQTT :)</p>
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 rounded-lg p-3">
                <p><span className="font-semibold text-foreground">Broker:</span> <span className="font-mono">{connectedBroker}</span></p>
                <p><span className="font-semibold text-foreground">Protocolo:</span> MQTT over WebSocket</p>
              </div>
              <Button onClick={() => setShowSuccessDialog(false)} className="w-full gap-2 text-base font-bold">
                OK
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 space-y-4">

        {/* PWA Warning — shown when in HTTPS without PWA install */}
        {showPwaWarning && (
          <Card className="border-destructive/60 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl shrink-0">🚨</span>
                <div>
                  <p className="text-sm font-bold text-destructive mb-1">Instale o app como PWA</p>
                  <p className="text-xs text-muted-foreground">
                    Seu navegador <strong className="text-foreground">bloqueia requisições HTTP</strong> de páginas HTTPS.
                    Para conectar ao robô, instale o app na tela inicial.
                  </p>
                </div>
              </div>
              <div className="bg-card rounded-lg p-3 mb-3 border border-border">
                <p className="text-xs font-semibold text-foreground mb-1.5">📱 Chrome / Edge:</p>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Menu <strong className="text-foreground">⋮</strong> → <strong className="text-foreground">Adicionar à tela inicial</strong></li>
                  <li>Confirme a instalação</li>
                  <li className="text-primary font-medium">Abra o app pelo ícone instalado (não pelo browser)</li>
                </ol>
                <p className="text-xs font-semibold text-foreground mt-2 mb-1.5">🍎 Safari / iOS:</p>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Botão Compartilhar <strong className="text-foreground">□↑</strong> → <strong className="text-foreground">Adicionar à Tela de Início</strong></li>
                  <li>Abra o app pelo ícone instalado</li>
                </ol>
              </div>
              <button
                onClick={() => setShowPwaWarning(false)}
                className="text-[11px] text-muted-foreground underline"
              >
                Entendi, esconder aviso
              </button>
            </CardContent>
          </Card>
        )}

        {/* WiFi Instructions */}
        <Card>
          <CardContent className="p-4">
            <button onClick={() => setShowInstructions(!showInstructions)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Como conectar</span>
              </div>
              {showInstructions ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {showInstructions && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <ol className="mt-3 space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                    <li>Abra as <strong className="text-foreground">Configurações WiFi</strong> do celular</li>
                    <li>Conecte a uma rede do robô:
                      <div className="flex flex-wrap gap-1 mt-1 ml-4">
                        {ROBOT_WIFI_NETWORKS.map(n => (
                          <span key={n} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">{n}</span>
                        ))}
                      </div>
                    </li>
                    <li>Volte ao app e clique <strong className="text-foreground">Verificar Conexão</strong></li>
                    <li>O app detectará o robô automaticamente</li>
                  </ol>
                  <p className="mt-2 text-[10px] text-muted-foreground">⚠️ Funciona 100% offline — ao conectar no robô, você ficará sem internet (normal)</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Connection Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {phase === 'connected'
                  ? <Radio className="w-5 h-5 text-success" />
                  : phase === 'connecting'
                  ? <Loader2 className="w-5 h-5 text-warning animate-spin" />
                  : <WifiOff className="w-5 h-5 text-muted-foreground" />
                }
                <span className="font-semibold text-sm text-foreground">
                  {phase === 'connected' ? 'MQTT Conectado' : phase === 'connecting' ? 'Conectando MQTT...' : 'Desconectado'}
                </span>
              </div>
              {phase === 'connected' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-mono">MQTT</span>
              )}
            </div>

            {/* MQTT broker info */}
            {phase === 'connected' && (
              <div className="grid grid-cols-1 gap-2 mb-3 p-2 rounded-lg bg-muted/30 text-[10px]">
                <div><span className="text-muted-foreground">Broker MQTT:</span> <span className="font-mono text-foreground">{connectedBroker}</span></div>
                <div><span className="text-muted-foreground">Mensagens:</span> <span className="text-foreground">{mqttMessages.length} recebidas</span></div>
                <div><span className="text-muted-foreground">SLAM:</span> <span className="font-mono text-foreground">192.168.99.2</span></div>
              </div>
            )}

            {phase !== 'connected' ? (
              <Button onClick={handleScan} disabled={phase === 'connecting'} className="w-full gap-2">
                {phase === 'connecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                {phase === 'connecting' ? 'Conectando MQTT...' : 'Conectar via MQTT'}
              </Button>
            ) : (
              <Button onClick={handleDisconnect} variant="outline" className="w-full gap-2">
                <WifiOff className="w-4 h-4" />
                Desconectar
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Troubleshooting Checklist — shown when disconnected */}
        {phase === 'disconnected' && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-warning mb-2 flex items-center gap-1">⚠️ Checklist de Diagnóstico MQTT</p>
              <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                <li className="flex items-start gap-2"><span className="text-success shrink-0">✅</span><span>Conectado ao Wi-Fi: <span className="text-foreground font-medium">RoboKen_Controle</span> ou <span className="text-foreground font-medium">RoboKen_Controle_5G</span></span></li>
                <li className="flex items-start gap-2"><span className="text-warning shrink-0">❓</span><span>Tablet do robô está ligado?</span></li>
                <li className="flex items-start gap-2"><span className="text-warning shrink-0">❓</span><span>Broker MQTT ativo no roteador (porta 1883)?</span></li>
                <li className="flex items-start gap-2"><span className="text-warning shrink-0">❓</span><span>App do robô está rodando no tablet?</span></li>
              </ul>
              <div className="mt-3 pt-3 border-t border-warning/20">
                <p className="text-[10px] text-muted-foreground font-medium mb-1">📡 Broker MQTT configurado:</p>
                <code className="text-[10px] bg-muted px-2 py-1 rounded block font-mono">{mqttConfig.activeBroker}</code>
                <button onClick={() => navigate('/mqtt-config')} className="mt-2 text-[10px] text-primary underline">
                  Alterar configuração MQTT →
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sensor Selection */}
        {phase === 'connected' && !isCalibrating && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sensores para Calibrar</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {ALL_SENSORS.map(id => {
                  const meta = SENSOR_META[id];
                  const selected = selectedSensors.includes(id);
                  return (
                    <button key={id} onClick={() => toggleSensor(id)}
                      className={`p-3 rounded-xl border text-left transition-all ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-card hover:bg-muted/50'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{meta.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{meta.label}</p>
                          <p className="text-[10px] text-muted-foreground">{meta.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedSensors([...ALL_SENSORS])}>Selecionar todos</Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedSensors([])}>Limpar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {isCalibrating && progress && (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Calibrando...</span>
                <span className="text-lg font-bold text-primary">{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="h-3" />
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">{progress.message}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {ALL_SENSORS.filter(s => selectedSensors.includes(s)).map(id => {
                  const meta = SENSOR_META[id];
                  const status = getSensorStatus(id, progress.currentSensor);
                  return (
                    <div key={id} className={`flex flex-col items-center p-2 rounded-lg text-center transition-all ${
                      status === 'complete' ? 'bg-success/10' : status === 'active' ? 'bg-primary/10 animate-pulse' : 'bg-muted/30'
                    }`}>
                      <span className="text-lg">{meta.icon}</span>
                      <span className="text-[9px] font-medium text-foreground mt-1">{meta.label}</span>
                      {status === 'complete' && <CheckCircle2 className="w-3 h-3 text-success mt-0.5" />}
                      {status === 'active' && <Loader2 className="w-3 h-3 animate-spin text-primary mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {calibData && !isCalibrating && (
          <Card className="border-success/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Dados de Calibração
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  calibData.status === 1 ? 'bg-success/10 text-success' :
                  calibData.status === 2 ? 'bg-warning/10 text-warning' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {calibData.status === 1 ? 'Válida' : calibData.status === 2 ? 'Recalibrar' : 'Inválida'}
                </span>
                <span className="text-muted-foreground">
                  #{calibData.calibrationCount} • {new Date(calibData.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              <button onClick={() => setShowData(!showData)} className="text-xs text-primary font-medium">
                {showData ? 'Ocultar dados técnicos ▲' : 'Ver dados técnicos ▼'}
              </button>
              <AnimatePresence>
                {showData && (
                  <motion.pre initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-auto max-h-60 text-[10px] font-mono bg-muted/30 rounded-lg p-3 text-muted-foreground"
                  >
                    {JSON.stringify(calibData, null, 2)}
                  </motion.pre>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {phase === 'connected' && (
          <div className="grid grid-cols-2 gap-3">
            {!isCalibrating ? (
              <>
                <Button onClick={handleStart} disabled={selectedSensors.length === 0} className="gap-2">
                  <Play className="w-4 h-4" /> Iniciar
                </Button>
                <Button onClick={handleReset} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Resetar
                </Button>
              </>
            ) : (
              <Button onClick={handleStop} variant="destructive" className="col-span-2 gap-2">
                <Square className="w-4 h-4" /> Parar Calibração
              </Button>
            )}
            {!isCalibrating && (
              <>
                <Button onClick={handleExport} variant="outline" className="gap-2" disabled={!calibData}>
                  <Download className="w-4 h-4" /> Exportar
                </Button>
                <Button onClick={handleImport} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" /> Importar
                </Button>
              </>
            )}
          </div>
        )}

        {/* MQTT Messages Panel */}
        <Card>
          <CardContent className="p-4">
            <button onClick={() => setShowMqttPanel(!showMqttPanel)} className="w-full flex items-center justify-between text-sm font-semibold text-foreground">
              <span className="flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /> Mensagens MQTT ({mqttMessages.length})</span>
              <span className="text-xs text-muted-foreground">{showMqttPanel ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            <AnimatePresence>
              {showMqttPanel && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5 bg-muted/20 rounded-lg p-2">
                    {mqttMessages.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem MQTT ainda</p>
                      : mqttMessages.map((m, i) => (
                        <div key={i} className="rounded-lg p-2 border border-border bg-muted/30 text-[10px] font-mono">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-primary font-bold truncate max-w-[180px]">{m.topic}</span>
                            <span className="text-muted-foreground ml-auto">{m.ts}</span>
                          </div>
                          <p className="text-foreground truncate">{JSON.stringify(m.payload)}</p>
                        </div>
                      ))
                    }
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs font-bold text-primary mb-1.5">ℹ️ Arquitetura MQTT</p>
                    <div className="space-y-0.5 text-[10px] text-muted-foreground">
                      <p>• Broker: <code className="bg-muted px-1 rounded text-foreground">ws://192.168.99.100:9002</code> (PC/Mosquitto WebSocket)</p>
                      <p>• Tablet: <code className="bg-muted px-1 rounded text-foreground">192.168.99.200</code></p>
                      <p>• Robô: <code className="bg-muted px-1 rounded text-foreground">192.168.99.101</code></p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardContent className="p-4">
            <button onClick={() => setShowLogs(!showLogs)} className="w-full flex items-center justify-between text-sm font-semibold text-foreground">
              <span>📋 Logs ({logs.length})</span>
              <span className="text-xs text-muted-foreground">{showLogs ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            <AnimatePresence>
              {showLogs && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 max-h-48 overflow-y-auto space-y-1 bg-muted/30 rounded-lg p-2">
                    {logs.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-4">Sem logs</p>
                      : logs.map((log, i) => <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{log}</p>)
                    }
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground pb-4">
          AlphaBot Companion v2.1.1 • Iascom
        </p>
      </div>
    </div>
  );
};

export default RobotCalibrationPanel;
