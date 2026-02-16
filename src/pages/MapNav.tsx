import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, MapPin, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';

const GRID_SIZE = 10;
const CELL_PX = 32;
const MAP_SIZE = GRID_SIZE * CELL_PX;

const obstacles = [
  [2, 3], [2, 4], [5, 7], [6, 7], [7, 2], [8, 8], [3, 6],
];

const MapNav = () => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { status, addLog } = useRobotStore();
  const { send } = useWebSocket();
  const [destination, setDestination] = useState<[number, number] | null>(null);

  const robotGridX = Math.min(Math.floor(status.posX), GRID_SIZE - 1);
  const robotGridY = Math.min(Math.floor(status.posY), GRID_SIZE - 1);

  const drawMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        const isObstacle = obstacles.some(([ox, oy]) => ox === x && oy === y);
        ctx.fillStyle = isObstacle ? 'hsl(207, 100%, 27%)' : 'hsl(0, 0%, 96%)';
        ctx.fillRect(x * CELL_PX + 1, y * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
        ctx.strokeStyle = 'hsl(214, 32%, 91%)';
        ctx.strokeRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }

    if (destination) {
      ctx.fillStyle = 'hsl(16, 100%, 60%)';
      ctx.beginPath();
      ctx.arc(destination[0] * CELL_PX + CELL_PX / 2, destination[1] * CELL_PX + CELL_PX / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('📍', destination[0] * CELL_PX + CELL_PX / 2, destination[1] * CELL_PX + CELL_PX / 2 + 4);
    }

    ctx.fillStyle = 'hsl(160, 84%, 39%)';
    ctx.beginPath();
    ctx.arc(robotGridX * CELL_PX + CELL_PX / 2, robotGridY * CELL_PX + CELL_PX / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('🤖', robotGridX * CELL_PX + CELL_PX / 2, robotGridY * CELL_PX + CELL_PX / 2 + 5);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { drawMap(); }, [status.posX, status.posY, destination, robotGridX, robotGridY]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.floor((e.clientX - rect.left) / CELL_PX);
    const y = Math.floor((e.clientY - rect.top) / CELL_PX);
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      const isObstacle = obstacles.some(([ox, oy]) => ox === x && oy === y);
      if (!isObstacle) {
        setDestination([x, y]);
        addLog(t('map.destinationSet', { x, y }), 'info');
        send({ type: 'navigate', data: { targetX: x, targetY: y }, timestamp: Date.now() });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('map.title')} />

      <div className="flex-1 p-4 flex flex-col items-center gap-4">
        <div className="bg-card rounded-2xl border border-border shadow-card p-4">
          <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} onClick={handleCanvasClick} className="rounded-xl cursor-pointer" />
        </div>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-success inline-block" /> {t('map.legend.robot')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-primary inline-block" /> {t('map.legend.destination')}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-secondary inline-block" /> {t('map.legend.obstacle')}</span>
        </div>

        <div className="w-full bg-card rounded-2xl border border-border shadow-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('map.position')}</span>
            <span className="font-semibold text-foreground">X: {status.posX.toFixed(1)}m, Y: {status.posY.toFixed(1)}m</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('map.orientation')}</span>
            <span className="font-semibold text-foreground">{status.orientation}° NE</span>
          </div>
          {destination && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('map.destination')}</span>
              <span className="font-semibold text-primary">({destination[0]}, {destination[1]})</span>
            </div>
          )}
        </div>

        <div className="w-full grid grid-cols-3 gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setDestination([0, 0]); send({ type: 'navigate', data: { targetX: 0, targetY: 0 }, timestamp: Date.now() }); }}
            className="min-h-[48px] rounded-xl bg-card border border-border flex flex-col items-center justify-center gap-1 active:bg-muted">
            <Home className="w-5 h-5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{t('map.base')}</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => addLog(t('map.markLog'), 'success')}
            className="min-h-[48px] rounded-xl bg-card border border-border flex flex-col items-center justify-center gap-1 active:bg-muted">
            <MapPin className="w-5 h-5 text-success" />
            <span className="text-xs font-semibold text-foreground">{t('map.mark')}</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => drawMap()}
            className="min-h-[48px] rounded-xl bg-card border border-border flex flex-col items-center justify-center gap-1 active:bg-muted">
            <RotateCw className="w-5 h-5 text-secondary" />
            <span className="text-xs font-semibold text-foreground">{t('map.refresh')}</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default MapNav;
