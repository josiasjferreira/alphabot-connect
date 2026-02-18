import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import Joystick from '@/components/Joystick';
import EmergencyButton from '@/components/EmergencyButton';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBluetoothSerial } from '@/hooks/useBluetoothSerial';
import { useRobotStore } from '@/store/useRobotStore';
import { rotationService } from '@/services/rotationService';
import { Bluetooth, BluetoothConnected, Wifi, RotateCcw, RotateCw, Compass } from 'lucide-react';

const Control = () => {
  const { t } = useTranslation();
  const { send } = useWebSocket();
  const { sendMove, sendStop, sendEmergencyStop, isSerialReady } = useBluetoothSerial();
  const { addLog, bluetoothStatus } = useRobotStore();
  const [speed, setSpeed] = useState(50);
  const [rotation, setRotation] = useState(30);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [currentDist, setCurrentDist] = useState(0);
  const [rotationSpeed, setRotationSpeed] = useState(40);
  const [isRotating, setIsRotating] = useState<'left' | 'right' | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout>>();

  const isBtActive = bluetoothStatus === 'paired' || bluetoothStatus === 'connected';

  const handleMove = useCallback((angle: number, distance: number) => {
    setCurrentAngle(Math.round(angle));
    setCurrentDist(Math.round(distance));

    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = undefined;
    }, 100);

    const computedSpeed = (distance / 100) * speed;

    // Send via both channels — the active one will deliver
    send({
      type: 'move',
      data: { angle, speed: computedSpeed, rotation },
      timestamp: Date.now(),
    });

    if (isBtActive) {
      sendMove(angle, computedSpeed, rotation);
    }
  }, [speed, rotation, send, sendMove, isBtActive]);

  const handleRelease = useCallback(() => {
    setCurrentAngle(0);
    setCurrentDist(0);
    send({ type: 'move', data: { angle: 0, speed: 0, rotation: 0 }, timestamp: Date.now() });

    if (isBtActive) {
      sendStop();
    }
  }, [send, sendStop, isBtActive]);

  const handleEmergency = () => {
    send({ type: 'emergency_stop', timestamp: Date.now() });
    addLog(t('control.emergencyLog'), 'error');
    useRobotStore.getState().dispatchEvent('EMERGENCY_STOP');
    rotationService.stop();
    setIsRotating(null);

    if (isBtActive) {
      sendEmergencyStop();
    }
  };

  const handleRotateLeft = async () => {
    setIsRotating('left');
    await rotationService.rotateLeft(rotationSpeed);
  };

  const handleRotateRight = async () => {
    setIsRotating('right');
    await rotationService.rotateRight(rotationSpeed);
  };

  const handleRotateStop = async () => {
    await rotationService.stop();
    setIsRotating(null);
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('control.title')} />

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Connection channel indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-semibold">
            <Wifi className="w-3 h-3 text-primary" /> WebSocket
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isBtActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {isBtActive ? <BluetoothConnected className="w-3 h-3" /> : <Bluetooth className="w-3 h-3" />}
            BT Serial {isSerialReady ? '✓' : isBtActive ? '◌' : '✗'}
          </div>
        </div>

        <div className="w-full aspect-video rounded-2xl bg-card border border-border flex items-center justify-center shadow-card">
          <div className="text-center text-muted-foreground">
            <div className="text-4xl mb-2">📹</div>
            <p className="text-sm font-medium">{t('control.videoStream')}</p>
            <p className="text-xs">{t('control.waitingFeed')}</p>
          </div>
        </div>

        <div className="flex gap-4 items-center justify-center">
          {/* Rotation buttons (left side) */}
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

          {/* Rotation buttons (right side) */}
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

        {/* Stats + Sliders */}
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
