import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Bluetooth, BluetoothOff, Play, Square, RotateCcw, ChevronLeft, Activity, CheckCircle2, XCircle, Loader2, Wifi, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCalibration } from '@/hooks/useCalibration';
import { ALL_SENSORS, type SensorId, type CalibrationChannel } from '@/services/bluetoothCalibrationBridge';

const SENSOR_META: Record<SensorId, { label: string; icon: string; description: string }> = {
  imu: { label: 'IMU', icon: '🔄', description: 'Acelerômetro + Giroscópio' },
  magnetometer: { label: 'Magnetômetro', icon: '🧭', description: 'Bússola digital' },
  odometer: { label: 'Odômetro', icon: '📏', description: 'Medição de distância' },
  lidar: { label: 'LiDAR', icon: '📡', description: 'Sensor de distância laser' },
  camera: { label: 'Câmera', icon: '📷', description: 'Calibração de lente' },
  battery: { label: 'Bateria', icon: '🔋', description: 'Tensão e carga' },
  temperature: { label: 'Temperatura', icon: '🌡️', description: 'Sensor térmico' },
};

const CHANNEL_LABELS: Record<CalibrationChannel, { label: string; color: string; icon: typeof Bluetooth }> = {
  ble: { label: 'BLE', color: 'bg-primary/10 text-primary', icon: Bluetooth },
  spp: { label: 'SPP', color: 'bg-blue-500/10 text-blue-500', icon: Radio },
  websocket: { label: 'WebSocket', color: 'bg-green-500/10 text-green-500', icon: Wifi },
  http: { label: 'HTTP', color: 'bg-orange-500/10 text-orange-500', icon: Activity },
  none: { label: 'Nenhum', color: 'bg-muted text-muted-foreground', icon: BluetoothOff },
};

const getSensorStatus = (sensorId: string, currentSensor: string | undefined, progressVal: number) => {
  if (!currentSensor) return 'idle';
  const currentIdx = ALL_SENSORS.indexOf(currentSensor as SensorId);
  const thisIdx = ALL_SENSORS.indexOf(sensorId as SensorId);
  if (thisIdx < currentIdx) return 'complete';
  if (thisIdx === currentIdx) return 'active';
  return 'idle';
};

const Calibration = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    bleAvailable, isConnected, progress, calibData, calibState, activeChannel,
    error, isCalibrating, logs, connect, disconnect,
    startCalibration, stopCalibration, resetCalibration, fetchData,
  } = useCalibration();

  const [selectedSensors, setSelectedSensors] = useState<SensorId[]>([...ALL_SENSORS]);
  const [showLogs, setShowLogs] = useState(false);

  // HTTPS enforcement for Web Bluetooth
  useEffect(() => {
    if (window.location.protocol !== 'https:' && 
        window.location.hostname !== 'localhost') {
      console.error('❌ HTTPS obrigatório!');
      alert('❌ Web Bluetooth requer HTTPS.\nRedirecionando...');
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  }, []);

  const toggleSensor = (id: SensorId) => {
    setSelectedSensors(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const channelInfo = CHANNEL_LABELS[activeChannel];
  const ChannelIcon = channelInfo.icon;

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-muted active:bg-muted/80">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">🔧 {t('calibration.title', 'Calibração de Sensores')}</h1>
            <p className="text-xs text-muted-foreground">CSJBot • Multi-Canal</p>
          </div>
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* BLE Availability Warning */}
        {!bleAvailable && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <BluetoothOff className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Web Bluetooth indisponível</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Fallback via SPP/WebSocket será usado se disponível.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bluetooth className={`w-5 h-5 ${isConnected ? 'text-green-500' : 'text-muted-foreground'}`} />
                <span className="font-semibold text-sm text-foreground">
                  {isConnected ? 'Conectado ao robô' : 'Desconectado'}
                </span>
              </div>
              {isConnected && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${channelInfo.color}`}>
                  <ChannelIcon className="w-3 h-3" />
                  {channelInfo.label}
                </span>
              )}
            </div>
            {!isConnected ? (
              <div className="space-y-2">
                {/* Debug: Botão de teste direto da Web Bluetooth API */}
                <button
                  onClick={async () => {
                    console.log('🧪 Teste Bluetooth iniciado');
                    try {
                      const device = await navigator.bluetooth.requestDevice({
                        acceptAllDevices: true
                      });
                      alert('✅ Funcionou! Device: ' + device.name);
                    } catch (e: any) {
                      alert('❌ Erro: ' + e.message);
                    }
                  }}
                  className="w-full bg-destructive text-destructive-foreground py-3 rounded-md text-sm font-medium"
                >
                  🧪 TESTE BLUETOOTH (Debug)
                </button>
                <Button onClick={() => { console.log('🔴 handleConnect chamado'); connect(); }} className="w-full gap-2">
                  <Bluetooth className="w-4 h-4" />
                  Conectar via Bluetooth
                </Button>
              </div>
            ) : (
              <Button onClick={disconnect} variant="outline" className="w-full gap-2">
                <BluetoothOff className="w-4 h-4" />
                Desconectar
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="p-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{error}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sensor Selection */}
        {isConnected && !isCalibrating && (
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
                    <button
                      key={id}
                      onClick={() => toggleSensor(id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border bg-card hover:bg-muted/50'
                      }`}
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
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedSensors([...ALL_SENSORS])}>
                  Selecionar todos
                </Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setSelectedSensors([])}>
                  Limpar
                </Button>
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

              {/* Sensor Status Grid */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                {ALL_SENSORS.filter(s => selectedSensors.includes(s)).map(id => {
                  const meta = SENSOR_META[id];
                  const status = getSensorStatus(id, progress.currentSensor, progress.progress);
                  return (
                    <div
                      key={id}
                      className={`flex flex-col items-center p-2 rounded-lg text-center ${
                        status === 'complete' ? 'bg-green-500/10' :
                        status === 'active' ? 'bg-primary/10 animate-pulse' :
                        'bg-muted/30'
                      }`}
                    >
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

        {/* Calibration Data Results */}
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
              <div className="space-y-2">
                {calibData.imu && (
                  <DataRow icon="🔄" label="IMU" values={[
                    `Bias: ${calibData.imu.biasX.toFixed(3)}, ${calibData.imu.biasY.toFixed(3)}, ${calibData.imu.biasZ.toFixed(3)}`,
                  ]} />
                )}
                {calibData.magnetometer && (
                  <DataRow icon="🧭" label="Magnetômetro" values={[
                    `Offset: ${calibData.magnetometer.offsetX.toFixed(1)}, ${calibData.magnetometer.offsetY.toFixed(1)}, ${calibData.magnetometer.offsetZ.toFixed(1)}`,
                  ]} />
                )}
                {calibData.odometer && (
                  <DataRow icon="📏" label="Odômetro" values={[
                    `L: ${calibData.odometer.pulsesPerMeterLeft} p/m | R: ${calibData.odometer.pulsesPerMeterRight} p/m`,
                  ]} />
                )}
                {calibData.lidar && (
                  <DataRow icon="📡" label="LiDAR" values={[
                    `Offset: ${calibData.lidar.offsetDistance.toFixed(3)}m | Ângulo: ${calibData.lidar.angleOffset.toFixed(2)}°`,
                  ]} />
                )}
                {calibData.camera && (
                  <DataRow icon="📷" label="Câmera" values={[
                    `Focal: ${calibData.camera.focalLength.toFixed(0)} | PP: ${calibData.camera.principalPointX.toFixed(0)},${calibData.camera.principalPointY.toFixed(0)}`,
                  ]} />
                )}
                {calibData.battery && (
                  <DataRow icon="🔋" label="Bateria" values={[
                    `Offset: ${calibData.battery.voltageOffset.toFixed(2)}V | Scale: ${calibData.battery.voltageScale.toFixed(3)}`,
                  ]} />
                )}
                {calibData.temperature && (
                  <DataRow icon="🌡️" label="Temperatura" values={[
                    `Offset: ${calibData.temperature.offset.toFixed(1)}°C`,
                  ]} />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-3">
            {!isCalibrating ? (
              <>
                <Button onClick={() => startCalibration(selectedSensors)} disabled={selectedSensors.length === 0} className="gap-2">
                  <Play className="w-4 h-4" />
                  Iniciar
                </Button>
                <Button onClick={resetCalibration} variant="outline" className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Resetar
                </Button>
              </>
            ) : (
              <Button onClick={stopCalibration} variant="destructive" className="col-span-2 gap-2">
                <Square className="w-4 h-4" />
                Parar Calibração
              </Button>
            )}
            {!isCalibrating && (
              <Button onClick={fetchData} variant="secondary" className="col-span-2 gap-2">
                <Activity className="w-4 h-4" />
                Ler Dados Atuais
              </Button>
            )}
          </div>
        )}

        {/* Logs */}
        <Card>
          <CardContent className="p-4">
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
                  <div className="mt-3 max-h-48 overflow-y-auto space-y-1 bg-muted/30 rounded-lg p-2">
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
          AlphaBot Companion v1.3.7 • Iascom
        </p>
      </div>
    </div>
  );
};

const DataRow = ({ icon, label, values }: { icon: string; label: string; values: string[] }) => (
  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/20">
    <span className="text-sm">{icon}</span>
    <div>
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {values.map((v, i) => (
        <p key={i} className="text-[10px] font-mono text-muted-foreground">{v}</p>
      ))}
    </div>
  </div>
);

export default Calibration;
