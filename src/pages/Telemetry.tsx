import { motion } from 'framer-motion';
import { Battery, Thermometer, Wifi, Volume2, Gauge, Compass, RotateCw, Download, Zap, RefreshCw, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { type RobotEvent, getAvailableEvents, STATE_LABELS } from '@/machine/robotStateMachine';

const EVENT_ICONS: Record<RobotEvent, string> = {
  START_DELIVERY: '🚀',
  DELIVERY_COMPLETE: '✅',
  START_CHARGING: '🔋',
  CHARGING_COMPLETE: '⚡',
  ARRIVE_RECEPTION: '👋',
  LEAVE_RECEPTION: '🚪',
  FAULT: '💥',
  RESET: '🔄',
  EMERGENCY_STOP: '🛑',
};

const Telemetry = () => {
  const { t } = useTranslation();
  const { status, logs, machineState, dispatchEvent, connectionStatus } = useRobotStore();
  const { connect } = useWebSocket();
  const availableEvents = getAvailableEvents(machineState);
  const stateInfo = STATE_LABELS[machineState];
  const isWsError = connectionStatus === 'error';

  const batteryLevel = typeof status.battery === 'number' && !isNaN(status.battery) ? Math.max(0, Math.min(100, Math.round(status.battery))) : 0;
  const batteryColor = batteryLevel > 50 ? 'text-success' : batteryLevel > 20 ? 'text-warning' : 'text-destructive';
  const batteryBg = batteryLevel > 50 ? 'bg-success' : batteryLevel > 20 ? 'bg-warning' : 'bg-destructive';
  const tempColor = status.temperature < 50 ? 'text-success' : status.temperature < 70 ? 'text-warning' : 'text-destructive';

  const sensors = [
    { icon: Wifi, label: t('telemetry.sensors.wifi'), value: `${'●'.repeat(status.wifiStrength)}${'○'.repeat(5 - status.wifiStrength)}`, color: 'text-secondary' },
    { icon: Thermometer, label: t('telemetry.sensors.temperature'), value: `${status.temperature}°C`, color: tempColor },
    { icon: Gauge, label: t('telemetry.sensors.consumption'), value: `${status.powerConsumption}W`, color: 'text-primary' },
    { icon: Volume2, label: t('telemetry.sensors.audio'), value: '●●●○○', color: 'text-muted-foreground' },
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
      <StatusHeader title={t('telemetry.title')} />

      <div className="p-4 space-y-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border shadow-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Battery className={`w-5 h-5 ${batteryColor}`} />
              <span className="font-bold text-foreground">{t('telemetry.battery')}</span>
            </div>
            <span className={`text-2xl font-bold ${batteryColor}`}>{batteryLevel}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${batteryBg}`} style={{ width: `${batteryLevel}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t('telemetry.batteryRemaining')}</p>
        </motion.div>

        {/* MQTT Status Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl border border-border shadow-card p-4 flex items-center gap-3">
          <Radio className="w-5 h-5 text-secondary" />
          <div>
            <span className="font-bold text-foreground text-sm">MQTT</span>
            <p className="text-xs font-medium text-muted-foreground">WiFi + MQTT/WebSocket</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {sensors.map((sensor, i) => (
            <motion.div key={sensor.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card rounded-2xl border border-border shadow-card p-3">
              <div className="flex items-center gap-2 mb-1">
                <sensor.icon className={`w-4 h-4 ${sensor.color}`} />
                <span className="text-xs font-semibold text-muted-foreground">{sensor.label}</span>
              </div>
              <p className="text-base font-bold text-foreground">{sensor.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground mb-3">{t('telemetry.motors')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('telemetry.motorLeft')}</p>
              <p className="text-lg font-bold text-foreground">{status.motorLeft || 1200} RPM <span className="text-success text-xs">✓</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('telemetry.motorRight')}</p>
              <p className="text-lg font-bold text-foreground">{status.motorRight || 1195} RPM <span className="text-success text-xs">✓</span></p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground mb-3">{t('telemetry.navigation')}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><RotateCw className="w-3 h-3" /> {t('telemetry.odometry')}</span>
              <span className="font-semibold text-foreground">{status.odometry}m</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Gauge className="w-3 h-3" /> {t('telemetry.speed')}</span>
              <span className="font-semibold text-foreground">{status.speed} m/s</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1"><Compass className="w-3 h-3" /> {t('telemetry.orientation')}</span>
              <span className="font-semibold text-foreground">{status.orientation}° NE</span>
            </div>
          </div>
        </div>

        {/* State Machine Simulator */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> {t('telemetry.stateSimulator')}
            </h3>
            <span className="text-sm font-bold text-foreground">
              {stateInfo.icon} {t(`stateMachine.${machineState}`)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableEvents.map((event) => (
              <motion.button
                key={event}
                whileTap={{ scale: 0.93 }}
                onClick={() => dispatchEvent(event)}
                className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold flex items-center gap-1.5 active:bg-primary active:text-primary-foreground transition-colors"
              >
                <span>{EVENT_ICONS[event]}</span>
                {event.replace(/_/g, ' ')}
              </motion.button>
            ))}
          </div>
          {availableEvents.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('telemetry.noTransitions')}</p>
          )}
        </motion.div>
        {/* Manual Reconnect Button */}
        {isWsError && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-destructive">{t('telemetry.wsLimitReached')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('telemetry.wsLimitHint')}</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => connect()}
              className="px-4 py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center gap-2 shadow-button"
            >
              <RefreshCw className="w-4 h-4" />
              {t('telemetry.reconnect')}
            </motion.button>
          </motion.div>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-muted-foreground">{t('telemetry.recentLogs')}</h3>
            <button className="text-xs text-primary font-semibold flex items-center gap-1">
              <Download className="w-3 h-3" /> {t('telemetry.export')}
            </button>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {logs.length === 0 && <p className="text-muted-foreground">{t('telemetry.noLogs')}</p>}
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
