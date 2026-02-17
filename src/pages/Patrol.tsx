import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Shield, Play, Square, Plus, Trash2, RotateCw } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Waypoint {
  id: string;
  name: string;
  x: number;
  y: number;
}

const Patrol = () => {
  const { t } = useTranslation();
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: '1', name: 'Entrada', x: 1.0, y: 0.5 },
    { id: '2', name: 'Corredor A', x: 5.2, y: 3.1 },
    { id: '3', name: 'Sala Server', x: 8.0, y: 6.4 },
  ]);
  const [patrolling, setPatrolling] = useState(false);
  const [currentWp, setCurrentWp] = useState(-1);
  const [newName, setNewName] = useState('');
  const [loops, setLoops] = useState(0);

  const startPatrol = () => {
    if (waypoints.length === 0) return;
    setPatrolling(true);
    setCurrentWp(0);
    setLoops(0);
    simulatePatrol(0, 0);
  };

  const simulatePatrol = (idx: number, loopCount: number) => {
    setTimeout(() => {
      if (!patrolling && idx > 0) return;
      const nextIdx = (idx + 1) % waypoints.length;
      const nextLoop = nextIdx === 0 ? loopCount + 1 : loopCount;
      setCurrentWp(nextIdx);
      setLoops(nextLoop);
      if (nextLoop < 3) simulatePatrol(nextIdx, nextLoop);
      else { setPatrolling(false); setCurrentWp(-1); }
    }, 2000);
  };

  const stopPatrol = () => { setPatrolling(false); setCurrentWp(-1); };

  const addWaypoint = () => {
    if (!newName.trim()) return;
    setWaypoints(prev => [...prev, {
      id: Date.now().toString(),
      name: newName.trim(),
      x: Math.round(Math.random() * 10 * 10) / 10,
      y: Math.round(Math.random() * 10 * 10) / 10,
    }]);
    setNewName('');
  };

  const removeWaypoint = (id: string) => setWaypoints(prev => prev.filter(w => w.id !== id));

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('patrol.title')} />
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={`w-5 h-5 ${patrolling ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
            <span className="text-sm font-semibold text-foreground">
              {patrolling ? t('patrol.active') : t('patrol.inactive')}
            </span>
            {patrolling && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <RotateCw className="w-3 h-3" /> {t('patrol.loop', { count: loops })}
              </span>
            )}
          </div>
          {patrolling ? (
            <Button variant="destructive" onClick={stopPatrol} className="gap-1">
              <Square className="w-4 h-4" /> {t('patrol.stop')}
            </Button>
          ) : (
            <Button onClick={startPatrol} disabled={waypoints.length === 0} className="gap-1">
              <Play className="w-4 h-4" /> {t('patrol.start')}
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('patrol.waypointPlaceholder')} onKeyDown={e => e.key === 'Enter' && addWaypoint()} />
          <Button onClick={addWaypoint} size="icon"><Plus className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-2">
          {waypoints.map((wp, i) => (
            <motion.div
              key={wp.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl border shadow-card transition-colors ${
                currentWp === i ? 'bg-primary/10 border-primary' : 'bg-card border-border'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                currentWp === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{wp.name}</p>
                <p className="text-xs text-muted-foreground">X: {wp.x}m  Y: {wp.y}m</p>
              </div>
              {!patrolling && (
                <Button size="icon" variant="ghost" onClick={() => removeWaypoint(wp.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Patrol;
