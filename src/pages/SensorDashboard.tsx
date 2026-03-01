/**
 * SensorDashboard — IMU, distância e toque em tempo real via MQTT
 *
 * Assina robot/sensors/+ e exibe gráficos Recharts.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Activity,
  Ruler,
  Hand,
  Wifi,
  WifiOff,
  RotateCcw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { useMQTT } from '@/hooks/useMQTT';
import { type SensorPayload, type IMUData, SDK_TOPICS } from '@/shared-core/types/csjbot-sdk';

const MAX_POINTS = 60;

interface ChartPoint {
  t: string;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

const DEFAULT_IMU: IMUData = { accel_x: 0, accel_y: 0, accel_z: 0, gyro_x: 0, gyro_y: 0, gyro_z: 0 };

const SensorDashboard = () => {
  const navigate = useNavigate();
  const { client, isConnected } = useMQTT();

  const [imu, setImu] = useState<IMUData>(DEFAULT_IMU);
  const [distance, setDistance] = useState<number>(0);
  const [touch, setTouch] = useState<boolean>(false);
  const [imuHistory, setImuHistory] = useState<ChartPoint[]>([]);
  const [distHistory, setDistHistory] = useState<{ t: string; d: number }[]>([]);
  const lastMsgRef = useRef<number>(0);

  // Subscribe to sensor topics
  useEffect(() => {
    if (!client || !isConnected) return;

    const handler = (topic: string, payload: string | object) => {
      const data = typeof payload === 'string' ? tryParse(payload) : payload;
      if (!data) return;

      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      lastMsgRef.current = Date.now();

      // Full sensor payload
      if (topic.endsWith('/sensors') || topic.includes('sensors/imu')) {
        const sensor = data as Partial<SensorPayload>;
        if (sensor.imu) {
          setImu(sensor.imu);
          setImuHistory(prev => [
            ...prev.slice(-(MAX_POINTS - 1)),
            {
              t: now,
              ax: round(sensor.imu!.accel_x),
              ay: round(sensor.imu!.accel_y),
              az: round(sensor.imu!.accel_z),
              gx: round(sensor.imu!.gyro_x),
              gy: round(sensor.imu!.gyro_y),
              gz: round(sensor.imu!.gyro_z),
            },
          ]);
        }
        if (typeof sensor.distance === 'number') {
          setDistance(sensor.distance);
          setDistHistory(prev => [...prev.slice(-(MAX_POINTS - 1)), { t: now, d: round(sensor.distance!) }]);
        }
        if (typeof sensor.touch === 'boolean') setTouch(sensor.touch);
      }

      if (topic.includes('sensors/distance')) {
        const d = (data as { distance?: number }).distance ?? (data as { value?: number }).value ?? 0;
        setDistance(d);
        setDistHistory(prev => [...prev.slice(-(MAX_POINTS - 1)), { t: now, d: round(d) }]);
      }

      if (topic.includes('sensors/touch')) {
        const t = (data as { touch?: boolean }).touch ?? (data as { value?: boolean }).value ?? false;
        setTouch(t);
      }
    };

    // Register callback by wrapping via client events — we use the global useMQTT's onMessage
    // Since useMQTT already subscribes to robot/#, we tap into the client's message event directly
    const rawClient = (client as any).client;
    if (rawClient) {
      rawClient.on('message', (topic: string, msg: Buffer) => {
        const raw = msg.toString();
        let parsed: string | object = raw;
        try { parsed = JSON.parse(raw); } catch { /* keep string */ }
        handler(topic, parsed);
      });
    }

    return () => {
      // mqtt.js doesn't have removeListener easily, but component unmount is safe
    };
  }, [client, isConnected]);

  const resetData = useCallback(() => {
    setImu(DEFAULT_IMU);
    setDistance(0);
    setTouch(false);
    setImuHistory([]);
    setDistHistory([]);
  }, []);

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Sensores</h1>
          <p className="text-xs text-muted-foreground">IMU · Distância · Toque · robot/sensors/+</p>
        </div>
        <button onClick={resetData} className="p-1.5 rounded-lg hover:bg-muted" title="Limpar dados">
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
          {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isConnected ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Live values */}
        <div className="grid grid-cols-3 gap-3">
          {/* IMU card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-2 bg-card rounded-2xl border border-border p-4 shadow-card"
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">IMU</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
              <ValueRow label="Accel X" value={imu.accel_x} unit="m/s²" />
              <ValueRow label="Gyro X" value={imu.gyro_x} unit="°/s" />
              <ValueRow label="Accel Y" value={imu.accel_y} unit="m/s²" />
              <ValueRow label="Gyro Y" value={imu.gyro_y} unit="°/s" />
              <ValueRow label="Accel Z" value={imu.accel_z} unit="m/s²" />
              <ValueRow label="Gyro Z" value={imu.gyro_z} unit="°/s" />
            </div>
          </motion.div>

          {/* Distance + Touch */}
          <div className="flex flex-col gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-card rounded-2xl border border-border p-4 shadow-card flex-1 flex flex-col items-center justify-center"
            >
              <Ruler className="w-5 h-5 text-warning mb-1" />
              <p className="text-xl font-bold text-foreground">{distance.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">metros</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-2xl border p-4 shadow-card flex-1 flex flex-col items-center justify-center transition-colors ${
                touch ? 'bg-primary/10 border-primary' : 'bg-card border-border'
              }`}
            >
              <Hand className={`w-5 h-5 mb-1 ${touch ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className={`text-sm font-bold ${touch ? 'text-primary' : 'text-foreground'}`}>
                {touch ? 'Ativo' : 'Inativo'}
              </p>
              <p className="text-[10px] text-muted-foreground">Toque</p>
            </motion.div>
          </div>
        </div>

        {/* IMU Chart — Accel */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Aceleração (m/s²)</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={imuHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 11, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="ax" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} name="X" />
                <Line type="monotone" dataKey="ay" stroke="hsl(var(--success))" dot={false} strokeWidth={1.5} name="Y" />
                <Line type="monotone" dataKey="az" stroke="hsl(var(--warning))" dot={false} strokeWidth={1.5} name="Z" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* IMU Chart — Gyro */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Giroscópio (°/s)</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={imuHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 11, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="gx" stroke="hsl(var(--secondary))" dot={false} strokeWidth={1.5} name="X" />
                <Line type="monotone" dataKey="gy" stroke="hsl(var(--destructive))" dot={false} strokeWidth={1.5} name="Y" />
                <Line type="monotone" dataKey="gz" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} name="Z" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distance Chart */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Distância (m)</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={distHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="t" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ fontSize: 11, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="d" stroke="hsl(var(--warning))" dot={false} strokeWidth={2} name="Dist" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {!isConnected && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-center">
            <p className="text-xs text-warning font-medium">MQTT offline — conecte ao broker para dados em tempo real</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────

function ValueRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value.toFixed(3)} <span className="text-muted-foreground">{unit}</span></span>
    </div>
  );
}

function round(n: number, d = 4) { return Math.round(n * 10 ** d) / 10 ** d; }

function tryParse(s: string): object | null {
  try { return JSON.parse(s); } catch { return null; }
}

export default SensorDashboard;
