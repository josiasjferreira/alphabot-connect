import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { useMQTT } from '@/hooks/useMQTT';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { useRobotStore } from '@/store/useRobotStore';
import Joystick from '@/components/Joystick';
import EmergencyButton from '@/components/EmergencyButton';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import AnimationsCard from '@/components/AnimationsCard';
import ChatIACard from '@/components/ChatIACard';
import NetworkInfo from '@/components/NetworkInfo';
import MqttEventLog from '@/components/MqttEventLog';
import {
  RotateCcw, RotateCw, StopCircle, Compass, Radio,
  ShoppingBag, Settings2,
  Wifi, WifiOff, Loader2,
} from 'lucide-react';

// ─── Manual Control Card ───
const ManualControlCard = () => {
  const { t } = useTranslation();
  const { client, isConnected, publish } = useMQTT();
  const serial = useMQTTConfigStore((s) => s.robotSerial) || 'H13307';
  const { addLog } = useRobotStore();

  const [speed, setSpeed] = useState(50);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [currentDist, setCurrentDist] = useState(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout>>();

  const angleToDirection = (angle: number): 'forward' | 'backward' | 'left' | 'right' => {
    const norm = ((angle % 360) + 360) % 360;
    if (norm >= 45 && norm < 135) return 'forward';
    if (norm >= 135 && norm < 225) return 'left';
    if (norm >= 225 && norm < 315) return 'backward';
    return 'right';
  };

  const handleMove = useCallback((angle: number, distance: number) => {
    setCurrentAngle(Math.round(angle));
    setCurrentDist(Math.round(distance));

    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => { throttleRef.current = undefined; }, 100);

    if (isConnected && distance > 5) {
      const dir = angleToDirection(angle);
      const spd = (distance / 100) * speed;
      client?.move(dir, spd / 100, 200, serial);
    }
  }, [speed, isConnected, client, serial]);

  const handleRelease = useCallback(() => {
    setCurrentAngle(0);
    setCurrentDist(0);
    if (isConnected) client?.move('stop', 0, 0, serial);
  }, [isConnected, client, serial]);

  const handleEmergency = () => {
    addLog('🚨 PARADA DE EMERGÊNCIA', 'error');
    if (isConnected) {
      publish(`robot/${serial}/movement/stop`, { timestamp: Date.now() });
      publish(`robot/${serial}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
      publish(`csjbot/${serial}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-4 shadow-card"
    >
      <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        🕹️ Controle Manual
        <MqttBadge />
      </h2>

      <div className="flex flex-col items-center gap-3">
        <Joystick size={180} onMove={handleMove} onRelease={handleRelease} />

        <div className="grid grid-cols-2 gap-2 w-full max-w-[200px]">
          <div className="bg-muted rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Ângulo</p>
            <p className="text-lg font-bold text-foreground">{currentAngle}°</p>
          </div>
          <div className="bg-muted rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Potência</p>
            <p className="text-lg font-bold text-primary">{currentDist}%</p>
          </div>
        </div>

        <div className="w-full">
          <label className="text-xs text-muted-foreground font-semibold mb-1 block">
            Velocidade máx: {speed}%
          </label>
          <Slider
            value={[speed]}
            onValueChange={([v]) => setSpeed(v)}
            min={10}
            max={100}
            step={5}
          />
        </div>

        <EmergencyButton onEmergency={handleEmergency} />
      </div>
    </motion.div>
  );
};

// ─── Rotation Control Card ───
const RotationControlCard = () => {
  const { client, isConnected } = useMQTT();
  const serial = useMQTTConfigStore((s) => s.robotSerial) || 'H13307';
  const { addLog } = useRobotStore();

  const [heading, setHeading] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(40);
  const [isRotating, setIsRotating] = useState<'left' | 'right' | null>(null);
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate heading rotation locally for visual feedback
  const startSimRotation = useCallback((dir: 'left' | 'right') => {
    if (simInterval.current) clearInterval(simInterval.current);
    simInterval.current = setInterval(() => {
      const delta = dir === 'right' ? rotationSpeed * 0.06 : -rotationSpeed * 0.06;
      setHeading((h) => ((h + delta) % 360 + 360) % 360);
    }, 50);
  }, [rotationSpeed]);

  const stopSimRotation = useCallback(() => {
    if (simInterval.current) { clearInterval(simInterval.current); simInterval.current = null; }
  }, []);

  useEffect(() => () => stopSimRotation(), [stopSimRotation]);

  const handleRotateLeft = () => {
    setIsRotating('left');
    addLog(`↺ Rotação esquerda (${rotationSpeed}%)`, 'info');
    startSimRotation('left');
    if (isConnected) client?.rotate('left', rotationSpeed / 100, 0, serial);
  };

  const handleRotateRight = () => {
    setIsRotating('right');
    addLog(`↻ Rotação direita (${rotationSpeed}%)`, 'info');
    startSimRotation('right');
    if (isConnected) client?.rotate('right', rotationSpeed / 100, 0, serial);
  };

  const handleStop = () => {
    stopSimRotation();
    setIsRotating(null);
    addLog('⏹ Rotação parada', 'warning');
    if (isConnected) client?.move('stop', 0, 0, serial);
  };

  const quickAngles = [0, 90, 180, 270];

  const handleGoToAngle = (angle: number) => {
    addLog(`🧭 Ir para ${angle}°`, 'info');
    // Animate heading to target
    setHeading(angle);
    if (isConnected) {
      client?.publish(`robot/${serial}/cmd`, {
        cmd: 'rotate_to',
        params: { angle, speed: rotationSpeed / 100 },
        timestamp: Date.now(),
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-card rounded-2xl border border-border p-4 shadow-card"
    >
      <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <Compass className="w-4 h-4 text-secondary" />
        Controle de Rotação
      </h2>

      {/* Mini compass */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3 3" />
            {[{ l: 'N', a: 0 }, { l: 'L', a: 90 }, { l: 'S', a: 180 }, { l: 'O', a: 270 }].map(d => {
              const r = 34;
              const rad = d.a * (Math.PI / 180);
              return (
                <text key={d.l} x={50 + r * Math.sin(rad)} y={50 - r * Math.cos(rad)}
                  textAnchor="middle" dominantBaseline="central"
                  className="fill-muted-foreground text-[8px] font-bold">{d.l}</text>
              );
            })}
            <g transform={`rotate(${heading}, 50, 50)`}>
              <polygon points="50,12 47,50 53,50" fill="hsl(var(--destructive))" opacity="0.85" />
              <polygon points="50,88 47,50 53,50" fill="hsl(var(--muted-foreground))" opacity="0.3" />
            </g>
            <circle cx="50" cy="50" r="4" fill="hsl(var(--primary))" />
            <circle cx="50" cy="50" r="2" fill="hsl(var(--background))" />
          </svg>
          {isRotating && (
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
          )}
        </div>
        <p className="text-2xl font-bold text-foreground">{Math.round(heading)}°</p>
      </div>

      {/* Rotation buttons */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          className="h-12 gap-1"
          onPointerDown={handleRotateLeft}
          onPointerUp={handleStop}
          onPointerLeave={handleStop}
        >
          <RotateCcw className="w-4 h-4" /> ↺
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-12 gap-1"
          onClick={handleStop}
        >
          <StopCircle className="w-4 h-4" /> Parar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-12 gap-1"
          onPointerDown={handleRotateRight}
          onPointerUp={handleStop}
          onPointerLeave={handleStop}
        >
          <RotateCw className="w-4 h-4" /> ↻
        </Button>
      </div>

      {/* Quick angles */}
      <div className="flex gap-2 mt-3 justify-center">
        {quickAngles.map((a) => (
          <button
            key={a}
            onClick={() => handleGoToAngle(a)}
            className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors"
          >
            {a}°
          </button>
        ))}
      </div>

      {/* Speed slider */}
      <div className="mt-3">
        <label className="text-xs text-muted-foreground font-semibold mb-1 block">
          Vel. angular: {rotationSpeed}%
        </label>
        <Slider
          value={[rotationSpeed]}
          onValueChange={([v]) => setRotationSpeed(v)}
          min={10}
          max={100}
          step={5}
        />
      </div>
    </motion.div>
  );
};

// ─── MQTT connection badge ───
const MqttBadge = () => {
  const { isConnected } = useMQTT();
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      isConnected
        ? 'bg-success/10 text-success border border-success/20'
        : 'bg-destructive/10 text-destructive border border-destructive/20'
    }`}>
      <Radio className="w-3 h-3" />
      MQTT {isConnected ? '✓' : '✗'}
    </span>
  );
};

// ─── Placeholder cards ───
const PlaceholderCard = ({ icon, title, desc, onClick }: {
  icon: React.ReactNode; title: string; desc: string; onClick?: () => void;
}) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.1 }}
    onClick={onClick}
    className="bg-card rounded-2xl border border-border p-4 shadow-card text-left w-full active:bg-muted transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  </motion.button>
);

// ─── Main Operation Dashboard ───
const OperationDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConnected, connect, brokerUrl } = useMQTT();
  const [connecting, setConnecting] = useState(false);

  const handleAutoConnect = async () => {
    setConnecting(true);
    try {
      await connect();
    } catch { /* handled internally */ }
    setConnecting(false);
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title="Painel de Operação" showBack={false} />

      {/* MQTT connection bar */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3 p-3 rounded-xl border border-warning/30 bg-warning/5 flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-warning">MQTT desconectado</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleAutoConnect} disabled={connecting} className="h-7 text-xs">
            {connecting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wifi className="w-3 h-3 mr-1" />}
            Conectar
          </Button>
        </motion.div>
      )}

      {isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3 p-2 rounded-xl border border-success/30 bg-success/5 flex items-center justify-center gap-2"
        >
          <Wifi className="w-3.5 h-3.5 text-success" />
          <span className="text-[11px] font-semibold text-success">Conectado: {brokerUrl}</span>
        </motion.div>
      )}

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Manual Control */}
        <ManualControlCard />

        {/* Rotation Control */}
        <RotationControlCard />

        {/* Animations */}
        <AnimationsCard />

        {/* Chat IA */}
        <ChatIACard />

        {/* Network Info */}
        <NetworkInfo />

        {/* MQTT Event Log */}
        <MqttEventLog />

        {/* Secondary cards */}
        <div className="grid grid-cols-1 gap-3">
          <PlaceholderCard
            icon={<ShoppingBag className="w-5 h-5 text-primary-foreground" />}
            title="Produtos Solar Life"
            desc="Catálogo e destaques"
            onClick={() => navigate('/showcase')}
          />
        </div>

        {/* Config dashboard link */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate('/config')}
        >
          <Settings2 className="w-4 h-4" />
          Dashboard de Configuração
        </Button>
      </div>

      <div className="flex flex-col items-center gap-1 py-4">
        <p className="text-[10px] text-muted-foreground">AlphaBot Connect v2.0.0 • Iascom</p>
      </div>
    </div>
  );
};

export default OperationDashboard;
