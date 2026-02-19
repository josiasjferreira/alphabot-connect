import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, WifiOff, Play, Square, RotateCcw, ChevronLeft, Activity, CheckCircle2,
  XCircle, Loader2, Download, Upload, Info, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { detectRobotIP, ROBOT_WIFI_NETWORKS, type RobotInfo, type ConnectionResult } from '@/services/RobotWiFiConnection';
import { RobotHTTPClient } from '@/services/RobotHTTPClient';
import type { CalibrationProgress, CalibrationData } from '@/services/bluetoothCalibrationBridge';
import { ALL_SENSORS, type SensorId } from '@/services/bluetoothCalibrationBridge';

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
  const clientRef = useRef<RobotHTTPClient | null>(null);

  const [phase, setPhase] = useState<'disconnected' | 'scanning' | 'connected'>('disconnected');
  const [robotInfo, setRobotInfo] = useState<RobotInfo | null>(null);
  const [latency, setLatency] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const [selectedSensors, setSelectedSensors] = useState<SensorId[]>([...ALL_SENSORS]);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [progress, setProgress] = useState<CalibrationProgress | null>(null);
  const [calibData, setCalibData] = useState<CalibrationData | null>(null);

  interface HttpLog { ts: string; url: string; method: string; status: number | null; ms: number | null; ok: boolean | null; err?: string; }
  const [logs, setLogs] = useState<string[]>([]);
  const [httpLogs, setHttpLogs] = useState<{ ts: string; url: string; method: string; status: number | null; ms: number | null; ok: boolean | null; err?: string }[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showHttpPanel, setShowHttpPanel] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const addHttpLog = useCallback(async (url: string, method: string, fetchFn: () => Promise<Response>) => {
    const ts = new Date().toLocaleTimeString();
    const start = performance.now();
    try {
      const res = await fetchFn();
      const ms = Math.round(performance.now() - start);
      setHttpLogs(prev => [{ ts, url, method, status: res.status, ms, ok: res.ok }, ...prev].slice(0, 50));
      return res;
    } catch (err: any) {
      const ms = Math.round(performance.now() - start);
      setHttpLogs(prev => [{ ts, url, method, status: null, ms, ok: false, err: err.message }, ...prev].slice(0, 50));
      throw err;
    }
  }, []);

  // Cleanup
  useEffect(() => () => { clientRef.current?.destroy(); }, []);

  // ─── Connection ───

  const handleScan = async () => {
    setPhase('scanning');
    setError(null);
    addLog('Buscando robô na rede WiFi...');

    const IP_FIXO = '192.168.0.1';
    const pingUrl = `http://${IP_FIXO}/api/ping`;
    addLog(`Testando: ${pingUrl}`);

    // Log HTTP ping attempt
    try {
      await addHttpLog(pingUrl, 'GET', () =>
        fetch(pingUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000), cache: 'no-store' })
      );
    } catch {
      // log captured via addHttpLog, continue with detectRobotIP
    }

    const result: ConnectionResult = await detectRobotIP();

    if (!result.success || !result.ip) {
      setPhase('disconnected');
      setError(result.error);
      addLog(`Falha: ${result.error}`);
      toast({ title: '❌ Robô não encontrado', description: 'Verifique a conexão WiFi (RoboKen_Controle)', variant: 'destructive' });
      return;
    }

    addLog(`✅ Robô encontrado em ${result.ip} (${result.latencyMs}ms)`);
    setRobotInfo(result.robotInfo);
    setLatency(result.latencyMs);

    // Create HTTP client
    const client = new RobotHTTPClient({
      ip: result.ip,
      onProgressUpdate: (p) => { setProgress(p); setIsCalibrating(p.progress > 0 && p.progress < 100); },
      onComplete: (d) => {
        setCalibData(d);
        setIsCalibrating(false);
        addLog('Calibração completa!');
        toast({ title: '✅ Calibração Concluída!' });
      },
      onError: (msg) => {
        setError(msg);
        setIsCalibrating(false);
        addLog(`Erro: ${msg}`);
      },
      onDisconnected: () => {
        setPhase('disconnected');
        setIsCalibrating(false);
        addLog('Conexão perdida');
        toast({ title: '🔴 Desconectado', description: 'Conexão WiFi perdida', variant: 'destructive' });
      },
      onLog: (msg) => {
        addLog(msg);
        if (msg.startsWith('[HTTP]')) {
          setHttpLogs(prev => [{ ts: new Date().toLocaleTimeString(), url: `http://${result.ip}/...`, method: 'GET', status: null, ms: null, ok: null, err: msg }, ...prev].slice(0, 50));
        }
      },
    });

    // Connect WebSocket for real-time updates
    client.connectWebSocket({
      onOpen: () => addLog('✅ WebSocket conectado: ws://192.168.0.1:8080'),
      onMessage: (data: any) => {
        addLog(`📡 WS: ${JSON.stringify(data).slice(0, 80)}`);
        if (data?.type === 'calibration_progress') {
          setProgress(data.progress);
        }
      },
      onError: () => addLog('⚠️ Erro no WebSocket'),
      onClose: () => addLog('🔌 WebSocket desconectado'),
    });

    clientRef.current?.destroy();
    clientRef.current = client;
    setPhase('connected');
    setShowSuccessDialog(true);
  };

  const handleDisconnect = () => {
    clientRef.current?.destroy();
    clientRef.current = null;
    setPhase('disconnected');
    setRobotInfo(null);
    setProgress(null);
    setIsCalibrating(false);
    setCalibData(null);
    addLog('Desconectado manualmente');
  };

  // ─── Calibration actions ───

  const handleStart = async () => {
    if (!clientRef.current) return;
    try {
      setError(null);
      setCalibData(null);
      await clientRef.current.startCalibration(selectedSensors);
      setIsCalibrating(true);
      addLog(`Calibração iniciada: ${selectedSensors.join(', ')}`);
    } catch (err: any) { setError(err.message); addLog(`Erro: ${err.message}`); }
  };

  const handleStop = async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.stopCalibration();
      setIsCalibrating(false);
      addLog('Calibração interrompida');
    } catch (err: any) { setError(err.message); }
  };

  const handleReset = async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.resetCalibration();
      setCalibData(null);
      setProgress(null);
      addLog('Calibração resetada');
      toast({ title: '🔄 Reset concluído' });
    } catch (err: any) { setError(err.message); }
  };

  const handleFetchData = async () => {
    if (!clientRef.current) return;
    try {
      const data = await clientRef.current.getCalibrationData();
      setCalibData(data);
      addLog('Dados lidos com sucesso');
    } catch (err: any) { setError(err.message); }
  };

  const handleExport = async () => {
    if (!clientRef.current) return;
    try {
      const data = await clientRef.current.exportCalibration();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `calibration-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      addLog('Dados exportados');
      toast({ title: '📦 Exportado!' });
    } catch (err: any) { setError(err.message); }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !clientRef.current) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as CalibrationData;
        if (!data.status && data.status !== 0) throw new Error('Arquivo de calibração inválido');
        await clientRef.current.importCalibration(data);
        setCalibData(data);
        addLog('Dados importados');
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
            <h1 className="text-lg font-bold text-foreground">📡 Calibração WiFi</h1>
            <p className="text-xs text-muted-foreground">CSJBot • HTTP REST • Offline</p>
          </div>
          <div className={`w-3 h-3 rounded-full transition-colors ${phase === 'connected' ? 'bg-green-500 animate-pulse' : phase === 'scanning' ? 'bg-warning animate-pulse' : 'bg-muted-foreground'}`} />
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
              <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">🎉 Parabéns!!</h2>
              <p className="text-sm text-foreground font-medium">Conectado ao Robô com sucesso :)</p>
              {robotInfo && (
                <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 rounded-lg p-3">
                  <p><span className="font-semibold text-foreground">IP:</span> <span className="font-mono">{robotInfo.ip}</span></p>
                  <p><span className="font-semibold text-foreground">Modelo:</span> {robotInfo.model}</p>
                  <p><span className="font-semibold text-foreground">Latência:</span> {latency}ms</p>
                </div>
              )}
              <Button onClick={() => setShowSuccessDialog(false)} className="w-full gap-2 text-base font-bold">
                OK
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 space-y-4">
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
                {phase === 'connected' ? <Wifi className="w-5 h-5 text-green-500" /> : <WifiOff className="w-5 h-5 text-muted-foreground" />}
                <span className="font-semibold text-sm text-foreground">
                  {phase === 'connected' ? 'Conectado via WiFi' : phase === 'scanning' ? 'Buscando...' : 'Desconectado'}
                </span>
              </div>
              {latency > 0 && phase === 'connected' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-mono">{latency}ms</span>
              )}
            </div>

            {/* Robot info */}
            {robotInfo && phase === 'connected' && (
              <div className="grid grid-cols-2 gap-2 mb-3 p-2 rounded-lg bg-muted/30 text-[10px]">
                <div><span className="text-muted-foreground">HTTP:</span> <span className="font-mono text-foreground">{robotInfo.ip}</span></div>
                <div><span className="text-muted-foreground">Modelo:</span> <span className="text-foreground">{robotInfo.model}</span></div>
                <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono text-foreground">{robotInfo.serial}</span></div>
                <div><span className="text-muted-foreground">Firmware:</span> <span className="text-foreground">{robotInfo.firmware}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">WebSocket:</span> <span className="font-mono text-foreground">ws://192.168.0.1:8080</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">SLAM:</span> <span className="font-mono text-foreground">192.168.99.2</span></div>
              </div>
            )}

            {phase !== 'connected' ? (
              <Button onClick={handleScan} disabled={phase === 'scanning'} className="w-full gap-2">
                {phase === 'scanning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {phase === 'scanning' ? 'Buscando robô...' : 'Verificar Conexão'}
              </Button>
            ) : (
              <Button onClick={handleDisconnect} variant="outline" className="w-full gap-2">
                <WifiOff className="w-4 h-4" />
                Desconectar
              </Button>
            )}
          </CardContent>
        </Card>

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
                      status === 'complete' ? 'bg-green-500/10' : status === 'active' ? 'bg-primary/10 animate-pulse' : 'bg-muted/30'
                    }`}>
                      <span className="text-lg">{meta.icon}</span>
                      <span className="text-[9px] font-medium text-foreground mt-1">{meta.label}</span>
                      {status === 'complete' && <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5" />}
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
          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Dados de Calibração
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${
                  calibData.status === 1 ? 'bg-green-500/10 text-green-500' :
                  calibData.status === 2 ? 'bg-yellow-500/10 text-yellow-500' :
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
                <Button onClick={handleFetchData} variant="secondary" className="col-span-2 gap-2">
                  <Activity className="w-4 h-4" /> Ler Dados Atuais
                </Button>
                <Button onClick={handleExport} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" /> Exportar
                </Button>
                <Button onClick={handleImport} variant="outline" className="gap-2">
                  <Upload className="w-4 h-4" /> Importar
                </Button>
              </>
            )}
          </div>
        )}

        {/* HTTP Debug Panel */}
        <Card>
          <CardContent className="p-4">
            <button onClick={() => setShowHttpPanel(!showHttpPanel)} className="w-full flex items-center justify-between text-sm font-semibold text-foreground">
              <span>🌐 Requisições HTTP ({httpLogs.length})</span>
              <span className="text-xs text-muted-foreground">{showHttpPanel ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            <AnimatePresence>
              {showHttpPanel && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 max-h-64 overflow-y-auto space-y-1.5 bg-muted/20 rounded-lg p-2">
                    {httpLogs.length === 0
                      ? <p className="text-xs text-muted-foreground text-center py-4">Nenhuma requisição ainda</p>
                      : httpLogs.map((h, i) => (
                        <div key={i} className={`rounded-lg p-2 border text-[10px] font-mono ${h.ok === true ? 'bg-green-500/5 border-green-500/20' : h.ok === false ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30 border-border'}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-bold px-1 rounded ${h.ok === true ? 'text-green-500' : h.ok === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {h.ok === true ? '✅' : h.ok === false ? '❌' : '⏳'}
                            </span>
                            <span className="text-primary font-bold">{h.method}</span>
                            <span className="text-foreground truncate max-w-[200px]">{h.url}</span>
                            {h.status != null && (
                              <span className={`px-1.5 py-0.5 rounded font-bold ${h.ok ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                                {h.status}
                              </span>
                            )}
                            {h.ms != null && <span className="text-muted-foreground">{h.ms}ms</span>}
                            <span className="text-muted-foreground ml-auto">{h.ts}</span>
                          </div>
                          {h.err && <p className="text-destructive mt-1 truncate">{h.err}</p>}
                        </div>
                      ))
                    }
                  </div>
                  {/* Port Forwarding Info */}
                  <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs font-bold text-primary mb-1.5">ℹ️ Acesso via Port Forwarding</p>
                    <div className="space-y-0.5 text-[10px] text-muted-foreground">
                      <p>• Roteador: <code className="bg-muted px-1 rounded text-foreground">192.168.0.1</code></p>
                      <p>• Tablet: <code className="bg-muted px-1 rounded text-foreground">192.168.0.199</code></p>
                      <p>• Robô (interno): <code className="bg-muted px-1 rounded text-foreground">192.168.99.101</code></p>
                      <p>• Endpoint: <code className="bg-muted px-1 rounded text-foreground">http://192.168.0.1:99/api</code></p>
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
          AlphaBot Companion v1.3.3 • Iascom
        </p>
      </div>
    </div>
  );
};

export default RobotCalibrationPanel;
