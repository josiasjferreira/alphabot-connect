import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import StatusHeader from '@/components/StatusHeader';
import Joystick from '@/components/Joystick';
import EmergencyButton from '@/components/EmergencyButton';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useMQTT } from '@/hooks/useMQTT';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { useRobotStore } from '@/store/useRobotStore';
import { useNeuroMock } from '@/hooks/useNeuroMock';
import {
  type JointAngles,
  type NeuroMode,
  JOINT_LIMITS,
  JOINT_LABELS,
  NEURO_MODES,
  SAFETY_LIMITS,
} from '@/shared-core/types/neuro';
import {
  Brain, Eye, Hand, AlertTriangle, Activity,
  Radio, Wifi, WifiOff, Zap,
} from 'lucide-react';

// ─── EEG Heatmap Bar ───
const EEGBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">{label}</span>
    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ duration: 0.1 }}
      />
    </div>
    <span className="text-[10px] font-mono text-foreground w-8">{(value * 100).toFixed(0)}%</span>
  </div>
);

// ─── Gaze Overlay Canvas ───
const GazeOverlay = ({ x, y, confidence }: { x: number; y: number; confidence: number }) => {
  const size = 120;
  const cx = ((x + 1) / 2) * size;
  const cy = ((y + 1) / 2) * size;
  const r = 4 + confidence * 6;

  return (
    <div className="relative bg-muted rounded-xl overflow-hidden" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        {/* Grid */}
        <line x1={size / 2} y1={0} x2={size / 2} y2={size} stroke="hsl(var(--border))" strokeWidth="0.5" />
        <line x1={0} y1={size / 2} x2={size} y2={size / 2} stroke="hsl(var(--border))" strokeWidth="0.5" />
        {/* Gaze point */}
        <circle cx={cx} cy={cy} r={r} fill="hsl(var(--destructive))" opacity={0.6} />
        <circle cx={cx} cy={cy} r={r * 0.4} fill="hsl(var(--destructive))" />
      </svg>
      <span className="absolute bottom-1 left-1 text-[8px] text-muted-foreground">👁️ Gaze</span>
    </div>
  );
};

// ─── Joint Slider ───
const JointSlider = ({
  jointKey,
  value,
  onChange,
}: {
  jointKey: keyof JointAngles;
  value: number;
  onChange: (key: keyof JointAngles, v: number) => void;
}) => {
  const [min, max] = JOINT_LIMITS[jointKey];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground w-24 truncate">{JOINT_LABELS[jointKey]}</span>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(jointKey, v)}
        min={min}
        max={max}
        step={1}
        className="flex-1"
      />
      <span className="text-xs font-mono text-foreground w-10 text-right">{value}°</span>
    </div>
  );
};

// ─── Main NeuroControl Page ───
const NeuroControl = () => {
  const { client, isConnected, publish } = useMQTT();
  const serial = useMQTTConfigStore((s) => s.robotSerial) || 'H13307';
  const { addLog } = useRobotStore();

  const [neuroActive, setNeuroActive] = useState(true);
  const [activeMode, setActiveMode] = useState<NeuroMode>('manual');
  const [autoMode, setAutoMode] = useState(false);
  const { eeg, gaze, isArtifact, detectIntent } = useNeuroMock(neuroActive);

  const [joints, setJoints] = useState<JointAngles>({
    headPan: 0, headTilt: 0,
    leftShoulder: 90, rightShoulder: 90,
    leftElbow: 45, rightElbow: 45,
    waist: 0,
  });

  const [speed, setSpeed] = useState(40);
  const lastCmdRef = useRef(0);

  // Auto-detect neuro mode
  useEffect(() => {
    if (!autoMode || !neuroActive) return;
    const detected = detectIntent();
    if (detected !== activeMode) {
      setActiveMode(detected);
      addLog(`NeuroMode: ${detected}`, detected === 'emergency' ? 'error' : 'info');
    }
  }, [eeg, gaze, autoMode, neuroActive, detectIntent, activeMode, addLog]);

  // Emergency on artifact
  useEffect(() => {
    if (isArtifact && neuroActive) {
      handleEmergency();
    }
  }, [isArtifact, neuroActive]);

  const handleJointChange = useCallback((key: keyof JointAngles, value: number) => {
    setJoints((prev) => ({ ...prev, [key]: value }));
    const now = Date.now();
    if (now - lastCmdRef.current < SAFETY_LIMITS.COMMAND_RATE_LIMIT_MS) return;
    lastCmdRef.current = now;
    if (isConnected) {
      publish(`emy/${serial}/joints/set`, { joint: key, angle: value, timestamp: now });
    }
  }, [isConnected, publish, serial]);

  const handleJoystickMove = useCallback((angle: number, distance: number) => {
    const now = Date.now();
    if (now - lastCmdRef.current < SAFETY_LIMITS.COMMAND_RATE_LIMIT_MS) return;
    lastCmdRef.current = now;
    const spd = (distance / 100) * speed * SAFETY_LIMITS.MAX_WALK_SPEED;
    if (isConnected && distance > 5) {
      publish(`emy/${serial}/cmd`, {
        cmd: 'walk',
        velocity: spd,
        direction: angle,
        timestamp: now,
      });
    }
  }, [speed, isConnected, publish, serial]);

  const handleJoystickRelease = useCallback(() => {
    if (isConnected) {
      publish(`emy/${serial}/cmd`, { cmd: 'stop', timestamp: Date.now() });
    }
  }, [isConnected, publish, serial]);

  const handleEmergency = () => {
    addLog('🚨 NEURO EMERGENCY STOP', 'error');
    setActiveMode('emergency');
    if (isConnected) {
      publish(`emy/${serial}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
    }
  };

  const handleGesture = (gesture: string) => {
    if (isConnected) {
      publish(`emy/${serial}/motion/gesture`, { gesture, timestamp: Date.now() });
    }
    addLog(`Gesto: ${gesture}`, 'info');
  };

  const resetJoints = () => {
    setJoints({
      headPan: 0, headTilt: 0,
      leftShoulder: 90, rightShoulder: 90,
      leftElbow: 45, rightElbow: 45,
      waist: 0,
    });
  };

  const modeConfig = NEURO_MODES.find((m) => m.mode === activeMode);

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title="Emy NeuroControl" showBack />

      {/* Status bar */}
      <div className="mx-4 mt-2 flex items-center gap-2 flex-wrap">
        <Badge variant={isConnected ? 'default' : 'destructive'} className="text-[10px] gap-1">
          {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          MQTT {isConnected ? '✓' : '✗'}
        </Badge>
        <Badge variant={neuroActive ? 'default' : 'secondary'} className="text-[10px] gap-1">
          <Brain className="w-3 h-3" /> Neuro {neuroActive ? 'ON' : 'OFF'}
        </Badge>
        <Badge variant={activeMode === 'emergency' ? 'destructive' : 'outline'} className="text-[10px] gap-1">
          {modeConfig?.icon} {modeConfig?.label}
        </Badge>
        {isArtifact && (
          <Badge variant="destructive" className="text-[10px] animate-pulse gap-1">
            <AlertTriangle className="w-3 h-3" /> Artifact!
          </Badge>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">

        {/* Neuro Data Panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-4 shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> EEG + Eye-Tracking
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Neuro Sim</span>
              <Switch checked={neuroActive} onCheckedChange={setNeuroActive} />
            </div>
          </div>

          <div className="flex gap-4">
            {/* EEG Bands */}
            <div className="flex-1 flex flex-col gap-1.5">
              <EEGBar label="δ Delta" value={eeg.delta} color="hsl(var(--solar-sky))" />
              <EEGBar label="θ Theta" value={eeg.theta} color="hsl(var(--solar-green))" />
              <EEGBar label="α Alpha" value={eeg.alpha} color="hsl(var(--solar-gold))" />
              <EEGBar label="β Beta" value={eeg.beta} color="hsl(var(--primary))" />
              <EEGBar label="γ Gamma" value={eeg.gamma} color="hsl(var(--destructive))" />
            </div>

            {/* Gaze overlay */}
            <div className="flex flex-col items-center gap-1">
              <GazeOverlay x={gaze.x} y={gaze.y} confidence={gaze.confidence} />
              <span className="text-[9px] text-muted-foreground">
                Pupil: {gaze.pupilDiameter.toFixed(1)}mm
              </span>
            </div>
          </div>

          {/* Auto-mode toggle */}
          <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-muted">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs font-semibold text-foreground">Auto NeuroMode</span>
            </div>
            <Switch checked={autoMode} onCheckedChange={setAutoMode} />
          </div>

          {/* Mode selector */}
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {NEURO_MODES.map((m) => (
              <button
                key={m.mode}
                onClick={() => { setAutoMode(false); setActiveMode(m.mode); }}
                className={`p-2 rounded-lg text-center transition-all ${
                  activeMode === m.mode
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <span className="text-base">{m.icon}</span>
                <p className="text-[8px] font-bold mt-0.5 leading-tight">{m.label}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Joystick + Speed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl border border-border p-4 shadow-card"
        >
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            🕹️ Navegação
            {activeMode === 'gaze_nav' && (
              <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">Gaze Active</Badge>
            )}
            {activeMode === 'mind_walk' && (
              <Badge className="text-[9px] bg-warning/20 text-warning border-warning/30">Mind Walk</Badge>
            )}
          </h2>

          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <Joystick size={150} onMove={handleJoystickMove} onRelease={handleJoystickRelease} />
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1 block">
                  Velocidade: {speed}% (max {SAFETY_LIMITS.MAX_WALK_SPEED}m/s)
                </label>
                <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={10} max={100} step={5} />
              </div>
              {/* Quick gestures */}
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1 block flex items-center gap-1">
                  <Hand className="w-3 h-3" /> Gestos Rápidos
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['wave', 'point', 'thumbsup', 'bow'].map((g) => (
                    <Button key={g} variant="outline" size="sm" className="text-xs h-8" onClick={() => handleGesture(g)}>
                      {g === 'wave' && '👋 Acenar'}
                      {g === 'point' && '👉 Apontar'}
                      {g === 'thumbsup' && '👍 Positivo'}
                      {g === 'bow' && '🙇 Curvar'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Joint Control */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-4 shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Controle de Articulações
            </h2>
            <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={resetJoints}>
              Reset
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {(Object.keys(joints) as (keyof JointAngles)[]).map((key) => (
              <JointSlider key={key} jointKey={key} value={joints[key]} onChange={handleJointChange} />
            ))}
          </div>
        </motion.div>

        {/* Emergency */}
        <EmergencyButton onEmergency={handleEmergency} />
      </div>

      <div className="flex flex-col items-center gap-1 py-3">
        <p className="text-[10px] text-muted-foreground">Emy H13307 NeuroControl v1.0 • Mock Mode</p>
      </div>
    </div>
  );
};

export default NeuroControl;
