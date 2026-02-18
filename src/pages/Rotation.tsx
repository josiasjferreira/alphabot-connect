import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import StatusHeader from '@/components/StatusHeader';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, RotateCw, StopCircle, Compass, Navigation, Loader2 } from 'lucide-react';
import { rotationService } from '@/services/rotationService';
import { useRobotStore } from '@/store/useRobotStore';

const Rotation = () => {
  const { t } = useTranslation();
  const { addLog } = useRobotStore();

  const [currentAngle, setCurrentAngle] = useState(0);
  const [speed, setSpeed] = useState(50);
  const [targetAngle, setTargetAngle] = useState('');
  const [rotating, setRotating] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [simMode, setSimMode] = useState(true);
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const simDirection = useRef<'left' | 'right' | null>(null);

  useEffect(() => {
    rotationService.onOrientationChange((o) => {
      setCurrentAngle(Math.round(o.angle));
      setAccuracy(o.accuracy);
    });

    // Try fetching real orientation
    rotationService.getOrientation().then((o) => {
      if (o.accuracy > 0) setSimMode(false);
    });

    return () => {
      rotationService.destroy();
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, []);

  const startSimRotation = useCallback((dir: 'left' | 'right') => {
    if (simInterval.current) clearInterval(simInterval.current);
    simDirection.current = dir;
    simInterval.current = setInterval(() => {
      const delta = dir === 'right' ? speed * 0.06 : -speed * 0.06;
      rotationService.setAngleFromExternal(rotationService.getCurrentAngle() + delta);
    }, 50);
  }, [speed]);

  const stopSimRotation = useCallback(() => {
    if (simInterval.current) {
      clearInterval(simInterval.current);
      simInterval.current = null;
    }
    simDirection.current = null;
  }, []);

  const handleRotateLeft = async () => {
    setRotating(true);
    addLog(t('rotation.logLeft', { speed }), 'info');
    if (simMode) {
      startSimRotation('left');
    } else {
      await rotationService.rotateLeft(speed);
    }
  };

  const handleRotateRight = async () => {
    setRotating(true);
    addLog(t('rotation.logRight', { speed }), 'info');
    if (simMode) {
      startSimRotation('right');
    } else {
      await rotationService.rotateRight(speed);
    }
  };

  const handleStop = async () => {
    stopSimRotation();
    setRotating(false);
    addLog(t('rotation.logStop'), 'warning');
    if (!simMode) await rotationService.stop();
  };

  const handleGoToAngle = async () => {
    const angle = parseFloat(targetAngle);
    if (isNaN(angle) || angle < 0 || angle > 360) return;
    setRotating(true);
    addLog(t('rotation.logGoto', { angle }), 'info');

    if (simMode) {
      // Animate to target
      const start = rotationService.getCurrentAngle();
      let diff = angle - start;
      if (diff > 180) diff -= 360;
      else if (diff < -180) diff += 360;
      const dir = diff > 0 ? 'right' : 'left';
      const steps = Math.abs(diff);
      let step = 0;
      if (simInterval.current) clearInterval(simInterval.current);
      simInterval.current = setInterval(() => {
        step += speed * 0.06;
        if (step >= steps) {
          rotationService.setAngleFromExternal(angle);
          stopSimRotation();
          setRotating(false);
          return;
        }
        const delta = dir === 'right' ? speed * 0.06 : -speed * 0.06;
        rotationService.setAngleFromExternal(rotationService.getCurrentAngle() + delta);
      }, 50);
    } else {
      await rotationService.rotateToAngle(angle, speed);
      setRotating(false);
    }
    setTargetAngle('');
  };

  const compassDirections = [
    { label: 'N', angle: 0 },
    { label: 'NE', angle: 45 },
    { label: 'L', angle: 90 },
    { label: 'SE', angle: 135 },
    { label: 'S', angle: 180 },
    { label: 'SO', angle: 225 },
    { label: 'O', angle: 270 },
    { label: 'NO', angle: 315 },
  ];

  const quickAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('rotation.title')} />

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Sim badge */}
        <div className="flex justify-center">
          <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${
            simMode ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
          }`}>
            {simMode ? t('rotation.simulated') : t('rotation.live')}
          </span>
        </div>

        {/* Compass SVG */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="relative w-56 h-56">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Outer ring */}
              <circle cx="100" cy="100" r="95" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
              <circle cx="100" cy="100" r="85" fill="none" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />

              {/* Tick marks */}
              {Array.from({ length: 36 }).map((_, i) => {
                const a = i * 10 * (Math.PI / 180);
                const major = i % 9 === 0;
                const r1 = major ? 78 : 82;
                const r2 = 90;
                return (
                  <line
                    key={i}
                    x1={100 + r1 * Math.sin(a)}
                    y1={100 - r1 * Math.cos(a)}
                    x2={100 + r2 * Math.sin(a)}
                    y2={100 - r2 * Math.cos(a)}
                    stroke={major ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
                    strokeWidth={major ? 2 : 1}
                  />
                );
              })}

              {/* Direction labels */}
              {compassDirections.map((d) => {
                const a = d.angle * (Math.PI / 180);
                const r = 68;
                return (
                  <text
                    key={d.label}
                    x={100 + r * Math.sin(a)}
                    y={100 - r * Math.cos(a)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-foreground text-[10px] font-bold"
                  >
                    {d.label}
                  </text>
                );
              })}

              {/* Needle */}
              <g transform={`rotate(${currentAngle}, 100, 100)`}>
                {/* North pointer (red) */}
                <polygon points="100,20 94,100 106,100" fill="hsl(var(--destructive))" opacity="0.9" />
                {/* South pointer */}
                <polygon points="100,180 94,100 106,100" fill="hsl(var(--muted-foreground))" opacity="0.4" />
              </g>

              {/* Center dot */}
              <circle cx="100" cy="100" r="6" fill="hsl(var(--primary))" />
              <circle cx="100" cy="100" r="3" fill="hsl(var(--background))" />
            </svg>

            {/* Pulse when rotating */}
            {rotating && (
              <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-20" />
            )}
          </div>

          {/* Angle display */}
          <div className="text-center mt-2">
            <p className="text-3xl font-bold text-foreground">{currentAngle}°</p>
            <p className="text-xs text-muted-foreground">
              {accuracy > 0 ? `${t('rotation.accuracy')}: ${accuracy}%` : t('rotation.simulated')}
            </p>
          </div>
        </motion.div>

        {/* Speed slider */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <label className="text-xs text-muted-foreground font-semibold mb-2 block">
            {t('rotation.angularSpeed', { value: speed })}
          </label>
          <Slider
            value={[speed]}
            onValueChange={([v]) => setSpeed(v)}
            min={10}
            max={100}
            step={5}
            disabled={rotating}
          />
        </div>

        {/* Rotation buttons */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            size="lg"
            className="h-16 text-lg gap-2"
            disabled={rotating && simDirection.current !== 'left'}
            onClick={handleRotateLeft}
          >
            <RotateCcw className="w-5 h-5" />
            {t('rotation.left')}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            className="h-16 text-lg gap-2"
            onClick={handleStop}
          >
            <StopCircle className="w-5 h-5" />
            {t('rotation.stop')}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-16 text-lg gap-2"
            disabled={rotating && simDirection.current !== 'right'}
            onClick={handleRotateRight}
          >
            <RotateCw className="w-5 h-5" />
            {t('rotation.right')}
          </Button>
        </div>

        {/* Go to angle */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <label className="text-xs text-muted-foreground font-semibold mb-2 block">
            <Navigation className="w-3 h-3 inline mr-1" />
            {t('rotation.gotoAngle')}
          </label>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={0}
              max={360}
              value={targetAngle}
              onChange={(e) => setTargetAngle(e.target.value)}
              placeholder="0–360"
              disabled={rotating}
              className="flex-1"
            />
            <span className="text-sm font-bold text-muted-foreground">°</span>
            <Button onClick={handleGoToAngle} disabled={rotating || !targetAngle} size="sm">
              {rotating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('rotation.go')}
            </Button>
          </div>

          {/* Quick angle buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            {quickAngles.map((a) => (
              <button
                key={a}
                onClick={() => { setTargetAngle(String(a)); }}
                className="px-2 py-1 text-xs rounded-lg bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors"
              >
                {a}°
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="bg-card rounded-2xl border border-border p-3 shadow-card text-center">
          <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
            {rotating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {t('rotation.statusRotating')}
              </>
            ) : (
              <>
                <Compass className="w-4 h-4 text-success" />
                {t('rotation.statusReady')}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Rotation;
