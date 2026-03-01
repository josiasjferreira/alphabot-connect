/**
 * Control.tsx — Tela de Controle Manual dedicada (sem Bluetooth).
 * Toda comunicação é via MQTT/WebSocket.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import Joystick from '@/components/Joystick';
import EmergencyButton from '@/components/EmergencyButton';
import VoiceInputPanel from '@/components/VoiceInputPanel';
import { useRobotStore } from '@/store/useRobotStore';
import { useMQTT } from '@/hooks/useMQTT';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { rotationService } from '@/services/rotationService';
import { RotateCcw, RotateCw, Compass, Radio } from 'lucide-react';

const Control = () => {
  const { t } = useTranslation();
  const { addLog } = useRobotStore();
  const { client: mqttClient, isConnected: isMqttConnected, publish: mqttPublish } = useMQTT();
  const mqttConfig = useMQTTConfigStore();
  const serial = mqttConfig.robotSerial || 'H13307';

  const [speed, setSpeed] = useState(50);
  const [rotation, setRotation] = useState(30);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [currentDist, setCurrentDist] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(40);
  const [isRotating, setIsRotating] = useState<'left' | 'right' | null>(null);
  const [heading, setHeading] = useState(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    rotationService.onOrientationChange((o) => {
      setHeading(Math.round(o.angle));
    });
    rotationService.getOrientation().catch(() => {});
    return () => { rotationService.destroy(); };
  }, []);

  const mqttMove = useCallback((direction: 'forward' | 'backward' | 'left' | 'right' | 'stop', spd = 0) => {
    if (!isMqttConnected) return;
    mqttClient?.move(direction, spd / 100, 200, serial);
  }, [isMqttConnected, mqttClient, serial]);

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

    const computedSpeed = (distance / 100) * speed;

    if (isMqttConnected && distance > 5) {
      const dir = angleToDirection(angle);
      mqttMove(dir, computedSpeed);
    }
  }, [speed, isMqttConnected, mqttMove]);

  const handleRelease = useCallback(() => {
    setCurrentAngle(0);
    setCurrentDist(0);
    if (isMqttConnected) mqttMove('stop');
  }, [isMqttConnected, mqttMove]);

  const handleEmergency = () => {
    addLog(t('control.emergencyLog'), 'error');
    useRobotStore.getState().dispatchEvent('EMERGENCY_STOP');
    rotationService.stop();
    setIsRotating(null);

    if (isMqttConnected) {
      mqttPublish(`robot/${serial}/movement/stop`, { timestamp: Date.now() });
      mqttPublish(`robot/${serial}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
      mqttPublish(`csjbot/${serial}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
    }
  };

  const handleRotateLeft = () => {
    setIsRotating('left');
    rotationService.rotateLeft(rotationSpeed);
    if (isMqttConnected) mqttClient?.rotate('left', rotationSpeed / 100, 0, serial);
  };

  const handleRotateRight = () => {
    setIsRotating('right');
    rotationService.rotateRight(rotationSpeed);
    if (isMqttConnected) mqttClient?.rotate('right', rotationSpeed / 100, 0, serial);
  };

  const handleRotateStop = () => {
    rotationService.stop();
    setIsRotating(null);
    if (isMqttConnected) mqttMove('stop');
  };

  // Voice command handler
  const handleVoiceCommand = useCallback((text: string) => {
    const cmd = text.toLowerCase();
    if (/frente|avan[cç]|forward/.test(cmd)) mqttMove('forward', speed);
    else if (/tr[aá]s|recue|backward/.test(cmd)) mqttMove('backward', speed);
    else if (/esquerda|left/.test(cmd)) mqttMove('left', speed);
    else if (/direita|right/.test(cmd)) mqttMove('right', speed);
    else if (/par[ea]|stop/.test(cmd)) mqttMove('stop');
    else if (/gir.*esquerda|rotate.*left/.test(cmd)) handleRotateLeft();
    else if (/gir.*direita|rotate.*right/.test(cmd)) handleRotateRight();
    else if (/emerg[eê]ncia|emergency/.test(cmd)) handleEmergency();
    addLog(`🗣️ Comando de voz: "${text}"`, 'info');
  }, [speed, mqttMove, addLog]);

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('control.title')} />

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Connection indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isMqttConnected ? 'bg-success/10 text-success border border-success/20' : 'bg-muted text-muted-foreground'
          }`}>
            <Radio className="w-3 h-3" />
            MQTT {isMqttConnected ? '✓' : '✗'}
          </div>
        </div>

        <div className="flex gap-3">
          {/* Mini Compass */}
          <div className="w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="3 3" />
              {[{ l: 'N', a: 0 }, { l: 'E', a: 90 }, { l: 'S', a: 180 }, { l: 'W', a: 270 }].map(d => {
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
          </div>

          {/* Video Stream */}
          <div className="flex-1 aspect-video rounded-2xl bg-card border border-border flex items-center justify-center shadow-card">
            <div className="text-center text-muted-foreground">
              <div className="text-3xl mb-1">📹</div>
              <p className="text-xs font-medium">{t('control.videoStream')}</p>
              <p className="text-[10px]">{t('control.waitingFeed')}</p>
            </div>
          </div>
        </div>

        {/* Heading readout */}
        <div className="flex items-center justify-center gap-2">
          <Compass className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-bold text-foreground">{heading}°</span>
          <span className="text-[10px] text-muted-foreground">heading</span>
        </div>

        <div className="flex gap-4 items-center justify-center">
          {/* Rotation left */}
          <div className="flex flex-col items-center gap-2">
            <button
              onPointerDown={handleRotateLeft}
              onPointerUp={handleRotateStop}
              onPointerLeave={handleRotateStop}
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                isRotating === 'left'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-card border border-border text-foreground active:bg-muted'
              }`}
            >
              <RotateCcw className="w-6 h-6" />
            </button>
            <span className="text-[10px] text-muted-foreground font-semibold">
              {t('control.rotateLeft', 'Esquerda')}
            </span>
          </div>

          <Joystick size={160} onMove={handleMove} onRelease={handleRelease} />

          {/* Rotation right */}
          <div className="flex flex-col items-center gap-2">
            <button
              onPointerDown={handleRotateRight}
              onPointerUp={handleRotateStop}
              onPointerLeave={handleRotateStop}
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                isRotating === 'right'
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-card border border-border text-foreground active:bg-muted'
              }`}
            >
              <RotateCw className="w-6 h-6" />
            </button>
            <span className="text-[10px] text-muted-foreground font-semibold">
              {t('control.rotateRight', 'Direita')}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground font-semibold">{t('control.angle')}</p>
            <p className="text-2xl font-bold text-foreground">{currentAngle}°</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 text-center">
            <p className="text-xs text-muted-foreground font-semibold">{t('control.power')}</p>
            <p className="text-2xl font-bold text-primary">{currentDist}%</p>
          </div>
        </div>

        {/* Voice Input */}
        <VoiceInputPanel onCommand={handleVoiceCommand} compact />

        {/* Sliders */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-semibold">{t('control.maxSpeed', { value: speed })}</label>
            <input type="range" min={10} max={100} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-primary mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-semibold">{t('control.rotation', { value: rotation })}</label>
            <input type="range" min={10} max={100} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full accent-secondary mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
              <Compass className="w-3 h-3" />
              {t('control.rotationSpeed', { value: rotationSpeed, defaultValue: `Vel. Rotação: ${rotationSpeed}%` })}
            </label>
            <input type="range" min={10} max={100} value={rotationSpeed} onChange={(e) => setRotationSpeed(Number(e.target.value))} className="w-full accent-primary mt-1" />
          </div>
        </div>

        <div className="mt-auto">
          <EmergencyButton onEmergency={handleEmergency} />
        </div>
      </div>
    </div>
  );
};

export default Control;
