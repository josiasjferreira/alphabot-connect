import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Play, Square, RotateCcw, Loader2, CheckCircle2, XCircle,
  Download, Upload, ChevronDown, ChevronUp, Settings, AlertTriangle,
  Clock, Activity, Zap, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useMQTT } from '@/hooks/useMQTT';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { PUB_TOPICS, SUB_TOPICS } from '@/shared-core/types/mqtt';
import {
  SUPPORTED_SENSORS, type SensorType,
  CalibrationState, calibrationStateToString,
  CALIBRATION_SCHEDULE, CALIBRATION_LIMITS,
  type CalibrationProgress as CalibProgressType,
  type CalibrationData as CalibDataType,
} from '@/shared-core/types/calibration';
import { ROBOT, APP } from '@/shared-core/constants';

// ─── Sensor Card Metadata ───

interface SensorMeta {
  label: string;
  icon: string;
  description: string;
  details: string;
  gradient: string;
}

const SENSOR_META: Record<SensorType, SensorMeta> = {
  imu: {
    label: 'IMU',
    icon: '🔄',
    description: 'Acelerômetro + Giroscópio',
    details: 'Calcula bias e escala dos 3 eixos. Robô deve ficar imóvel em superfície plana.',
    gradient: 'from-primary to-secondary',
  },
  magnetometer: {
    label: 'Magnetômetro',
    icon: '🧭',
    description: 'Bússola digital 3 eixos',
    details: 'Calcula offset magnético. Robô gira 360° durante a calibração (~30s).',
    gradient: 'from-secondary to-primary',
  },
  odometer: {
    label: 'Odômetro',
    icon: '📏',
    description: 'Encoders das rodas',
    details: 'Calcula pulsos/metro para cada roda. Robô anda 1m em linha reta.',
    gradient: 'from-warning to-secondary',
  },
  lidar: {
    label: 'LiDAR',
    icon: '📡',
    description: 'Sensor de distância laser',
    details: 'Mede offset e ângulo. Alvo fixo a distância conhecida necessário.',
    gradient: 'from-destructive to-warning',
  },
  camera: {
    label: 'Câmera',
    icon: '📷',
    description: 'Parâmetros intrínsecos',
    details: 'Calibra distorção de lente, foco e ponto principal.',
    gradient: 'from-primary to-success',
  },
  battery: {
    label: 'Bateria',
    icon: '🔋',
    description: 'Tensão e corrente',
    details: 'Calcula offset e escala de voltagem para leitura precisa.',
    gradient: 'from-success to-warning',
  },
  temperature: {
    label: 'Temperatura',
    icon: '🌡️',
    description: 'Sensores térmicos',
    details: 'Calcula offset de temperatura para múltiplos pontos de medição.',
    gradient: 'from-warning to-destructive',
  },
};

// ─── Per-sensor status tracked during calibration ───

type SensorCalibStatus = 'idle' | 'running' | 'complete' | 'error';

interface SensorState {
  status: SensorCalibStatus;
  progress: number;
  error?: string;
}

const Calibration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, publish, client, connect } = useMQTT();
  const mqttConfig = useMQTTConfigStore();
  const serial = mqttConfig.robotSerial || ROBOT.SERIAL;

  // State
  const [selectedSensors, setSelectedSensors] = useState<SensorType[]>([...SUPPORTED_SENSORS]);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [currentSensor, setCurrentSensor] = useState<string>('');
  const [calibState, setCalibState] = useState<CalibrationState>(CalibrationState.IDLE);
  const [sensorStates, setSensorStates] = useState<Record<SensorType, SensorState>>(() => {
    const init: Record<string, SensorState> = {};
    SUPPORTED_SENSORS.forEach(s => { init[s] = { status: 'idle', progress: 0 }; });
    return init as Record<SensorType, SensorState>;
  });
  const [calibData, setCalibData] = useState<CalibDataType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [expandedSensor, setExpandedSensor] = useState<SensorType | null>(null);
  const [estimatedTime, setEstimatedTime] = useState(0);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 150));
  }, []);

  // ─── MQTT message handling for calibration topics ───

  // Listen for calibration messages via the global onMessage from RobotMQTTClient
  // The RobotMQTTClient already subscribes to robot/{serial}/# — so calibration topics are covered.
  // We intercept via a custom onMessage wrapper injected into the connect callback.
  useEffect(() => {
    if (!client || !isConnected) return;

    // Patch the existing callbacks to also handle calibration messages
    const origCallbacks = (client as any).callbacks as { onMessage?: (topic: string, payload: any) => void };
    const origOnMessage = origCallbacks.onMessage;

    origCallbacks.onMessage = (topic: string, payload: any) => {
      // Call original first
      origOnMessage?.(topic, payload);

      // Handle calibration topics
      const data = typeof payload === 'string' ? (() => { try { return JSON.parse(payload); } catch { return null; } })() : payload;
      if (!data) return;

      if (topic.includes('calibration/progress')) {
        const p = data as CalibProgressType;
        setGlobalProgress(p.progress);
        setCurrentSensor(p.currentSensor);
        setCalibState(p.state);
        setEstimatedTime(p.estimatedTimeRemaining || 0);
        setIsCalibrating(p.progress > 0 && p.progress < 100);

        if (p.sensors) {
          setSensorStates(prev => {
            const next = { ...prev };
            p.sensors.forEach(s => {
              const key = s.name as SensorType;
              if (SUPPORTED_SENSORS.includes(key)) {
                next[key] = { status: s.status as SensorCalibStatus, progress: s.progress, error: s.error };
              }
            });
            return next;
          });
        }
        addLog(`📊 Progresso: ${p.progress}% — ${p.currentSensor} (${calibrationStateToString(p.state)})`);
      }

      if (topic.includes('calibration/complete')) {
        const d = data as CalibDataType;
        setCalibData(d);
        setIsCalibrating(false);
        setGlobalProgress(100);
        setCalibState(CalibrationState.COMPLETE);
        setSensorStates(prev => {
          const next = { ...prev };
          SUPPORTED_SENSORS.forEach(s => { next[s] = { status: 'complete', progress: 100 }; });
          return next;
        });
        addLog('✅ Calibração completa!');
        toast({ title: '✅ Calibração Concluída!', description: `${d.calibrationCount}ª calibração registrada.` });
      }

      if (topic.includes('calibration/error')) {
        const errMsg = (data as { error: string }).error || 'Erro desconhecido';
        setError(errMsg);
        setIsCalibrating(false);
        setCalibState(CalibrationState.ERROR);
        addLog(`❌ Erro: ${errMsg}`);
        toast({ title: '❌ Erro na Calibração', description: errMsg, variant: 'destructive' });
      }
    };

    addLog(`📡 Monitorando tópicos de calibração para ${serial}`);

    return () => {
      // Restore original callback
      if (origCallbacks) origCallbacks.onMessage = origOnMessage;
    };
  }, [client, isConnected, serial, addLog, toast]);

  // ─── Actions ───

  const handleConnect = async () => {
    try {
      await connect();
      addLog('🔗 Conectando ao broker MQTT...');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStart = () => {
    if (!isConnected) return;
    setError(null);
    setCalibData(null);
    setGlobalProgress(0);

    // Reset sensor states for selected sensors
    setSensorStates(prev => {
      const next = { ...prev };
      SUPPORTED_SENSORS.forEach(s => { next[s] = { status: 'idle', progress: 0 }; });
      return next;
    });

    const payload = { robotSN: serial, sensors: selectedSensors, timestamp: Date.now() };
    publish(PUB_TOPICS.calibrationStart(serial), payload);
    setIsCalibrating(true);
    addLog(`🚀 Calibração iniciada: ${selectedSensors.join(', ')}`);
    toast({ title: '🚀 Calibração Iniciada', description: `Sensores: ${selectedSensors.length}` });
  };

  const handleStop = () => {
    if (!isConnected) return;
    publish(PUB_TOPICS.calibrationStop(serial), { robotSN: serial, timestamp: Date.now() });
    setIsCalibrating(false);
    addLog('⏹ Calibração interrompida');
  };

  const handleReset = () => {
    if (!isConnected) return;
    publish(PUB_TOPICS.calibrationReset(serial), { robotSN: serial, timestamp: Date.now() });
    setCalibData(null);
    setGlobalProgress(0);
    setSensorStates(prev => {
      const next = { ...prev };
      SUPPORTED_SENSORS.forEach(s => { next[s] = { status: 'idle', progress: 0 }; });
      return next;
    });
    addLog('🔄 Reset enviado');
    toast({ title: '🔄 Reset enviado ao robô' });
  };

  const handleSingleSensor = (sensor: SensorType) => {
    if (!isConnected || isCalibrating) return;
    setError(null);
    setCalibData(null);
    setSensorStates(prev => ({
      ...prev,
      [sensor]: { status: 'idle', progress: 0 },
    }));
    const payload = { robotSN: serial, sensor, timestamp: Date.now() };
    publish(PUB_TOPICS.calibrationStart(serial), { ...payload, sensors: [sensor] });
    setIsCalibrating(true);
    setCurrentSensor(sensor);
    addLog(`🎯 Calibração individual: ${SENSOR_META[sensor].label}`);
  };

  const handleExport = () => {
    if (!calibData) return;
    const blob = new Blob([JSON.stringify(calibData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `calibration-${serial}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    addLog('📦 Dados exportados');
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
        const data = JSON.parse(text) as CalibDataType;
        setCalibData(data);
        addLog('📥 Dados importados');
        toast({ title: '📥 Importado!' });
      } catch (err: any) {
        setError(err.message);
      }
    };
    input.click();
  };

  const toggleSensor = (id: SensorType) => {
    if (isCalibrating) return;
    setSelectedSensors(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const getSensorStatusIcon = (status: SensorCalibStatus) => {
    switch (status) {
      case 'complete': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'error': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  // ─── Render ───

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/config')} className="p-2 -ml-2 rounded-xl hover:bg-muted active:bg-muted/80">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">🔧 Calibração de Sensores</h1>
            <p className="text-xs text-muted-foreground">CSJBot • {serial} • MQTT</p>
          </div>
          <button onClick={() => navigate('/mqtt-config')} className="p-2 rounded-xl hover:bg-muted" title="Config MQTT">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Connection Banner */}
        {!isConnected && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">MQTT Desconectado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conecte-se ao broker para iniciar a calibração dos sensores.
                  </p>
                </div>
              </div>
              <Button onClick={handleConnect} className="w-full gap-2">
                <Zap className="w-4 h-4" />
                Conectar MQTT
              </Button>
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
                  <p className="text-xs text-destructive">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto text-destructive/60 hover:text-destructive text-xs">✕</button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Progress */}
        {isCalibrating && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-semibold text-foreground">Calibrando...</span>
                </div>
                <span className="text-2xl font-bold text-primary">{globalProgress}%</span>
              </div>
              <Progress value={globalProgress} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{calibrationStateToString(calibState)}</span>
                {estimatedTime > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{estimatedTime}s restantes
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calibration Complete Banner */}
        {calibData && !isCalibrating && calibState === CalibrationState.COMPLETE && (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">Calibração Concluída!</p>
                  <p className="text-xs text-muted-foreground">
                    #{calibData.calibrationCount} • {new Date(calibData.timestamp * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── SENSOR CARDS GRID ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Sensores ({selectedSensors.length}/{SUPPORTED_SENSORS.length})</h2>
            {!isCalibrating && (
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSensors([...SUPPORTED_SENSORS])}
                  className="text-[10px] text-primary font-semibold"
                >
                  Todos
                </button>
                <button
                  onClick={() => setSelectedSensors([])}
                  className="text-[10px] text-muted-foreground font-semibold"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {SUPPORTED_SENSORS.map((sensor, i) => {
              const meta = SENSOR_META[sensor];
              const sState = sensorStates[sensor];
              const selected = selectedSensors.includes(sensor);
              const isExpanded = expandedSensor === sensor;
              const schedule = CALIBRATION_SCHEDULE[sensor];

              return (
                <motion.div
                  key={sensor}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className={`overflow-hidden transition-all ${
                    sState.status === 'running' ? 'border-primary/40 shadow-md' :
                    sState.status === 'complete' ? 'border-success/30' :
                    sState.status === 'error' ? 'border-destructive/30' :
                    selected ? 'border-primary/20' : 'border-border'
                  }`}>
                    <CardContent className="p-0">
                      {/* Main row */}
                      <div className="flex items-center gap-3 p-3">
                        {/* Selection checkbox area */}
                        <button
                          onClick={() => toggleSensor(sensor)}
                          disabled={isCalibrating}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                            selected
                              ? `bg-gradient-to-br ${meta.gradient} shadow-sm`
                              : 'bg-muted/50'
                          }`}
                        >
                          <span className="text-lg">{meta.icon}</span>
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{meta.label}</p>
                            {getSensorStatusIcon(sState.status)}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
                          {sState.status === 'running' && (
                            <div className="mt-1.5">
                              <Progress value={sState.progress} className="h-1.5" />
                              <p className="text-[9px] text-primary mt-0.5">{sState.progress}%</p>
                            </div>
                          )}
                          {sState.status === 'error' && sState.error && (
                            <p className="text-[10px] text-destructive mt-1">{sState.error}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isCalibrating && isConnected && (
                            <button
                              onClick={() => handleSingleSensor(sensor)}
                              className="p-2 rounded-lg hover:bg-primary/10 active:bg-primary/20 transition-colors"
                              title={`Calibrar ${meta.label}`}
                            >
                              <Play className="w-4 h-4 text-primary" />
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedSensor(isExpanded ? null : sensor)}
                            className="p-2 rounded-lg hover:bg-muted active:bg-muted/80 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2">
                              <p className="text-[11px] text-muted-foreground">{meta.details}</p>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 rounded-lg bg-muted/30">
                                  <p className="text-[9px] text-muted-foreground font-semibold uppercase">Frequência</p>
                                  <p className="text-[11px] text-foreground font-medium">{schedule.description}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-muted/30">
                                  <p className="text-[9px] text-muted-foreground font-semibold uppercase">Intervalo</p>
                                  <p className="text-[11px] text-foreground font-medium">
                                    {schedule.hours ? `${schedule.hours}h` : ''}
                                    {schedule.km ? `${schedule.km}km` : ''}
                                    {'cycles' in schedule && schedule.cycles ? `${schedule.cycles} ciclos` : ''}
                                  </p>
                                </div>
                              </div>

                              {/* Show calibration data for this sensor if available */}
                              {calibData && (
                                <SensorDataDisplay sensor={sensor} data={calibData} />
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ─── ACTION BUTTONS ─── */}
        {isConnected && (
          <div className="space-y-2">
            {!isCalibrating ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleStart}
                  disabled={selectedSensors.length === 0}
                  className="gap-2"
                >
                  <Play className="w-4 h-4" />
                  Calibrar ({selectedSensors.length})
                </Button>
                <Button onClick={handleReset} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Resetar
                </Button>
              </div>
            ) : (
              <Button onClick={handleStop} variant="destructive" className="w-full gap-2">
                <Square className="w-4 h-4" />
                Parar Calibração
              </Button>
            )}

            {/* Export / Import */}
            {!isCalibrating && (
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleExport} variant="secondary" size="sm" disabled={!calibData} className="gap-2 text-xs">
                  <Download className="w-3 h-3" />
                  Exportar
                </Button>
                <Button onClick={handleImport} variant="secondary" size="sm" className="gap-2 text-xs">
                  <Upload className="w-3 h-3" />
                  Importar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ─── SCHEDULE / LIMITS INFO ─── */}
        <Card>
          <CardContent className="p-3">
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full flex items-center justify-between text-sm font-semibold text-foreground"
            >
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Cronograma e Limites
              </span>
              {showSchedule ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {showSchedule && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Limites de Validação (firmware)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(CALIBRATION_LIMITS).map(([key, val]) => (
                        <div key={key} className="p-2 rounded-lg bg-muted/30">
                          <p className="text-[9px] text-muted-foreground">{key}</p>
                          <p className="text-xs font-mono text-foreground">{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* ─── LOGS ─── */}
        <Card>
          <CardContent className="p-3">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between text-sm font-semibold text-foreground"
            >
              <span>📋 Logs ({logs.length})</span>
              <span className="text-xs text-muted-foreground">{showLogs ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            <AnimatePresence>
              {showLogs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 max-h-48 overflow-y-auto space-y-0.5 bg-muted/30 rounded-lg p-2">
                    {logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem logs</p>
                    ) : (
                      logs.map((log, i) => (
                        <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{log}</p>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-[10px] text-center text-muted-foreground pb-4">
          {APP.FOOTER}
        </p>
      </div>
    </div>
  );
};

// ─── Per-sensor calibration data display ───

const SensorDataDisplay = ({ sensor, data }: { sensor: SensorType; data: CalibDataType }) => {
  const rows: { label: string; value: string }[] = [];

  switch (sensor) {
    case 'imu':
      rows.push(
        { label: 'Bias X/Y/Z', value: `${data.imuBiasX.toFixed(4)}, ${data.imuBiasY.toFixed(4)}, ${data.imuBiasZ.toFixed(4)}` },
        { label: 'Scale X/Y/Z', value: `${data.imuScaleX.toFixed(4)}, ${data.imuScaleY.toFixed(4)}, ${data.imuScaleZ.toFixed(4)}` },
      );
      break;
    case 'magnetometer':
      rows.push(
        { label: 'Offset X/Y/Z', value: `${data.magOffsetX.toFixed(1)}, ${data.magOffsetY.toFixed(1)}, ${data.magOffsetZ.toFixed(1)}` },
        { label: 'Scale X/Y/Z', value: `${data.magScaleX.toFixed(3)}, ${data.magScaleY.toFixed(3)}, ${data.magScaleZ.toFixed(3)}` },
      );
      break;
    case 'odometer':
      rows.push(
        { label: 'Pulsos/m (L)', value: String(data.pulsesPerMeterLeft) },
        { label: 'Pulsos/m (R)', value: String(data.pulsesPerMeterRight) },
      );
      break;
    case 'lidar':
      rows.push(
        { label: 'Offset Dist.', value: `${data.lidarOffsetDistance.toFixed(4)}m` },
        { label: 'Ângulo Offset', value: `${data.lidarAngleOffset.toFixed(3)}°` },
      );
      break;
    case 'camera':
      rows.push(
        { label: 'Focal', value: String(data.cameraFocalLength.toFixed(1)) },
        { label: 'PP', value: `${data.cameraPrincipalPointX.toFixed(0)}, ${data.cameraPrincipalPointY.toFixed(0)}` },
        { label: 'K1/K2', value: `${data.cameraDistortionK1.toFixed(4)}, ${data.cameraDistortionK2.toFixed(4)}` },
      );
      break;
    case 'battery':
      rows.push(
        { label: 'V Offset', value: `${data.batteryVoltageOffset.toFixed(3)}V` },
        { label: 'V Scale', value: data.batteryVoltageScale.toFixed(4) },
      );
      break;
    case 'temperature':
      rows.push({ label: 'Offset', value: `${data.tempOffset.toFixed(2)}°C` });
      break;
  }

  if (rows.length === 0) return null;

  return (
    <div className="p-2 rounded-lg bg-success/5 border border-success/20">
      <p className="text-[9px] font-bold text-success uppercase mb-1">Dados Calibrados</p>
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="font-mono text-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
};

export default Calibration;
