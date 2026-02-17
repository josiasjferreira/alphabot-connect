import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Package, MapPin, Clock, CheckCircle, Plus, Trash2 } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DeliveryTask {
  id: string;
  destination: string;
  status: 'pending' | 'in_progress' | 'delivered';
  createdAt: Date;
}

const Delivery = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<DeliveryTask[]>([
    { id: '1', destination: 'Sala 101', status: 'delivered', createdAt: new Date(Date.now() - 3600000) },
    { id: '2', destination: 'Recepção', status: 'in_progress', createdAt: new Date(Date.now() - 600000) },
  ]);
  const [newDest, setNewDest] = useState('');

  const addTask = () => {
    if (!newDest.trim()) return;
    setTasks(prev => [...prev, {
      id: Date.now().toString(),
      destination: newDest.trim(),
      status: 'pending',
      createdAt: new Date(),
    }]);
    setNewDest('');
  };

  const startDelivery = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'in_progress' } : t));
  };

  const completeDelivery = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'delivered' } : t));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const statusColor = (s: DeliveryTask['status']) => {
    if (s === 'delivered') return 'text-success';
    if (s === 'in_progress') return 'text-warning';
    return 'text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('delivery.title')} />
      <div className="flex-1 p-4 space-y-4">
        <div className="flex gap-2">
          <Input
            value={newDest}
            onChange={e => setNewDest(e.target.value)}
            placeholder={t('delivery.destinationPlaceholder')}
            onKeyDown={e => e.key === 'Enter' && addTask()}
          />
          <Button onClick={addTask} size="icon"><Plus className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-2">
          {tasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-xl bg-card border border-border shadow-card"
            >
              <div className="flex items-center gap-3">
                <Package className={`w-5 h-5 ${statusColor(task.status)}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{task.destination}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {task.createdAt.toLocaleTimeString()}
                    </span>
                    <span className={`text-xs font-semibold ml-2 ${statusColor(task.status)}`}>
                      {t(`delivery.status.${task.status}`)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {task.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => startDelivery(task.id)}>
                      {t('delivery.start')}
                    </Button>
                  )}
                  {task.status === 'in_progress' && (
                    <Button size="sm" onClick={() => completeDelivery(task.id)} className="gap-1">
                      <CheckCircle className="w-3 h-3" /> {t('delivery.complete')}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => removeTask(task.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
          {tasks.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">{t('delivery.empty')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Delivery;
