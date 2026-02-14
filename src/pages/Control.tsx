import { useState, useRef, useCallback } from 'react';
import StatusHeader from '@/components/StatusHeader';
import Joystick from '@/components/Joystick';
import EmergencyButton from '@/components/EmergencyButton';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRobotStore } from '@/store/useRobotStore';

const Control = () => {
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
    addLog('⚠️ PARADA DE EMERGÊNCIA ativada!', 'error');
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title="Controle Manual" />

      <div className="flex-1 p-4 flex flex-col gap-4">
        {/* Video placeholder */}
        <div className="w-full aspect-video rounded-2xl bg-card border border-border flex items-center justify-center shadow-card">
          <div className="text-center text-muted-foreground">
            <div className="text-4xl mb-2">📹</div>
            <p className="text-sm font-medium">Vídeo Stream</p>
            <p className="text-xs">Aguardando feed de câmera</p>
          </div>
        </div>

        {/* Joystick + controls row */}
        <div className="flex gap-4 items-center justify-center">
          <Joystick size={180} onMove={handleMove} onRelease={handleRelease} />

          <div className="flex-1 space-y-4 max-w-[160px]">
            {/* Speed info */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold">ÂNGULO</p>
              <p className="text-2xl font-bold text-foreground">{currentAngle}°</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-semibold">POTÊNCIA</p>
              <p className="text-2xl font-bold text-primary">{currentDist}%</p>
            </div>

            {/* Speed slider */}
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Vel. Máx: {speed}%</label>
              <input
                type="range"
                min={10}
                max={100}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-primary mt-1"
              />
            </div>

            {/* Rotation slider */}
            <div>
              <label className="text-xs text-muted-foreground font-semibold">Rotação: {rotation}%</label>
              <input
                type="range"
                min={10}
                max={100}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full accent-secondary mt-1"
              />
            </div>
          </div>
        </div>

        {/* Emergency button */}
        <div className="mt-auto">
          <EmergencyButton onEmergency={handleEmergency} />
        </div>
      </div>
    </div>
  );
};

export default Control;
