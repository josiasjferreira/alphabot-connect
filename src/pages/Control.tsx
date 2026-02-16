import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import Joystick from '@/components/Joystick';
import EmergencyButton from '@/components/EmergencyButton';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRobotStore } from '@/store/useRobotStore';

const Control = () => {
  const { t } = useTranslation();
  const { send } = useWebSocket();
  const { addLog } = useRobotStore();
  const [speed, setSpeed] = useState(50);
  const [rotation, setRotation] = useState(30);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [currentDist, setCurrentDist] = useState(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMove = useCallback((angle: number, distance: number) => {
    setCurrentAngle(Math.round(angle));
    setCurrentDist(Math.round(distance));

    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = undefined;
    }, 100);

    send({
      type: 'move',
      data: { angle, speed: (distance / 100) * speed, rotation },
      timestamp: Date.now(),
    });
  }, [speed, rotation, send]);

  const handleRelease = useCallback(() => {
    setCurrentAngle(0);
    setCurrentDist(0);
    send({ type: 'move', data: { angle: 0, speed: 0, rotation: 0 }, timestamp: Date.now() });
  }, [send]);

  const handleEmergency = () => {
    send({ type: 'emergency_stop', timestamp: Date.now() });
    addLog(t('control.emergencyLog'), 'error');
    // Transition state machine to ERROR via EMERGENCY_STOP event
    useRobotStore.getState().dispatchEvent('EMERGENCY_STOP');
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('control.title')} />

      <div className="flex-1 p-4 flex flex-col gap-4">
        <div className="w-full aspect-video rounded-2xl bg-card border border-border flex items-center justify-center shadow-card">
          <div className="text-center text-muted-foreground">
            <div className="text-4xl mb-2">📹</div>
            <p className="text-sm font-medium">{t('control.videoStream')}</p>
            <p className="text-xs">{t('control.waitingFeed')}</p>
          </div>
        </div>

        <div className="flex gap-4 items-center justify-center">
          <Joystick size={180} onMove={handleMove} onRelease={handleRelease} />

          <div className="flex-1 space-y-4 max-w-[160px]">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold">{t('control.angle')}</p>
              <p className="text-2xl font-bold text-foreground">{currentAngle}°</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold">{t('control.power')}</p>
              <p className="text-2xl font-bold text-primary">{currentDist}%</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold">{t('control.maxSpeed', { value: speed })}</label>
              <input type="range" min={10} max={100} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-primary mt-1" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold">{t('control.rotation', { value: rotation })}</label>
              <input type="range" min={10} max={100} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full accent-secondary mt-1" />
            </div>
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
