import { motion } from 'framer-motion';
import { Battery, Thermometer, Wifi, Volume2, Gauge, Compass, RotateCw, Download } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { useRobotStore } from '@/store/useRobotStore';

const Telemetry = () => {
  const { status, logs } = useRobotStore();

  const batteryColor = status.battery > 50 ? 'text-success' : status.battery > 20 ? 'text-warning' : 'text-destructive';
  const batteryBg = status.battery > 50 ? 'bg-success' : status.battery > 20 ? 'bg-warning' : 'bg-destructive';
  const tempColor = status.temperature < 50 ? 'text-success' : status.temperature < 70 ? 'text-warning' : 'text-destructive';

  const sensors = [
    { icon: Wifi, label: 'WiFi', value: `${'●'.repeat(status.wifiStrength)}${'○'.repeat(5 - status.wifiStrength)}`, color: 'text-secondary' },
    { icon: Thermometer, label: 'Temperatura', value: `${status.temperature}°C`, color: tempColor },
    { icon: Gauge, label: 'Consumo', value: `${status.powerConsumption}W`, color: 'text-primary' },
    { icon: Volume2, label: 'Áudio', value: '●●●○○', color: 'text-muted-foreground' },
  ];

  const formatTime = (d: Date) => {
    const date = new Date(d);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  const logTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-success';
      case 'warning': return 'text-warning';
      case 'error': return 'text-destructive';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title="📊 Telemetria" />

      <div className="p-4 space-y-4">
        {/* Battery */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border shadow-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Battery className={`w-5 h-5 ${batteryColor}`} />
              <span className="font-bold text-foreground">Bateria</span>
            </div>
            <span className={`text-2xl font-bold ${batteryColor}`}>{status.battery}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${batteryBg}`}
              style={{ width: `${status.battery}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">≈ 2h 30min restantes</p>
        </motion.div>

        {/* Sensors grid */}
        <div className="grid grid-cols-2 gap-3">
          {sensors.map((sensor, i) => (
            <motion.div
              key={sensor.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border shadow-card p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <sensor.icon className={`w-4 h-4 ${sensor.color}`} />
                <span className="text-xs font-semibold text-muted-foreground">{sensor.label}</span>
              </div>
              <p className="text-base font-bold text-foreground">{sensor.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Motors */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground mb-3">MOTORES</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Esquerdo</p>
              <p className="text-lg font-bold text-foreground">{status.motorLeft || 1200} RPM <span className="text-success text-xs">✓</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Direito</p>
              <p className="text-lg font-bold text-foreground">{status.motorRight || 1195} RPM <span className="text-success text-xs">✓</span></p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground mb-3">NAVEGAÇÃO</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><RotateCw className="w-3 h-3" /> Odometria</span>
              <span className="font-semibold text-foreground">{status.odometry}m</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Gauge className="w-3 h-3" /> Velocidade</span>
              <span className="font-semibold text-foreground">{status.speed} m/s</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Compass className="w-3 h-3" /> Orientação</span>
              <span className="font-semibold text-foreground">{status.orientation}° NE</span>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-muted-foreground">LOGS RECENTES</h3>
            <button className="text-xs text-primary font-semibold flex items-center gap-1">
              <Download className="w-3 h-3" /> Exportar
            </button>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {logs.length === 0 && <p className="text-muted-foreground">Nenhum log disponível</p>}
            {logs.slice(0, 8).map((log, i) => (
              <div key={i} className={`flex gap-2 ${logTypeColor(log.type)}`}>
                <span className="text-muted-foreground flex-shrink-0">[{formatTime(log.timestamp)}]</span>
                <span className="truncate">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Telemetry;
