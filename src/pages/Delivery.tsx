import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Package, MapPin, Clock, CheckCircle, Plus, Trash2, Navigation, AlertTriangle } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DeliveryTask {
  id: string;
  destination: string;
  floor: string;
  priority: 'normal' | 'urgent';
  notes: string;
  status: 'pending' | 'in_progress' | 'delivered';
  createdAt: Date;
}

const Delivery = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<DeliveryTask[]>([
    { id: '1', destination: 'Sala 101', floor: '1º Andar', priority: 'normal', notes: '', status: 'delivered', createdAt: new Date(Date.now() - 3600000) },
    { id: '2', destination: 'Recepção', floor: 'Térreo', priority: 'urgent', notes: 'Entregar na mesa 3', status: 'in_progress', createdAt: new Date(Date.now() - 600000) },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDest, setNewDest] = useState('');
  const [newFloor, setNewFloor] = useState('');
  const [newPriority, setNewPriority] = useState<'normal' | 'urgent'>('normal');
  const [newNotes, setNewNotes] = useState('');

  const resetForm = () => {
    setNewDest('');
    setNewFloor('');
    setNewPriority('normal');
    setNewNotes('');
  };

  const addTask = () => {
    if (!newDest.trim()) return;
    setTasks(prev => [...prev, {
      id: Date.now().toString(),
      destination: newDest.trim(),
      floor: newFloor.trim(),
      priority: newPriority,
      notes: newNotes.trim(),
      status: 'pending' as const,
      createdAt: new Date(),
    }]);
    resetForm();
    setDialogOpen(false);
  };

  const startDelivery = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'in_progress' as const } : t));
  };

  const completeDelivery = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'delivered' as const } : t));
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
        {/* Add delivery button */}
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="w-full gap-2 h-12 text-base">
          <Plus className="w-5 h-5" />
          {t('delivery.addLocation')}
        </Button>

        {/* Add delivery dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5 text-primary" />
                {t('delivery.addLocation')}
              </DialogTitle>
              <DialogDescription>{t('delivery.addLocationDesc')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="destination">{t('delivery.destination')}</Label>
                <Input
                  id="destination"
                  value={newDest}
                  onChange={e => setNewDest(e.target.value)}
                  placeholder={t('delivery.destinationPlaceholder')}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor">{t('delivery.floor')}</Label>
                <Input
                  id="floor"
                  value={newFloor}
                  onChange={e => setNewFloor(e.target.value)}
                  placeholder={t('delivery.floorPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('delivery.priority')}</Label>
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v as 'normal' | 'urgent')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{t('delivery.priorityNormal')}</SelectItem>
                    <SelectItem value="urgent">{t('delivery.priorityUrgent')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t('delivery.notes')}</Label>
                <Input
                  id="notes"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder={t('delivery.notesPlaceholder')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t('delivery.cancel')}
              </Button>
              <Button onClick={addTask} disabled={!newDest.trim()} className="gap-1">
                <Plus className="w-4 h-4" /> {t('delivery.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Task list */}
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
                <div className="relative">
                  <Package className={`w-5 h-5 ${statusColor(task.status)}`} />
                  {task.priority === 'urgent' && (
                    <AlertTriangle className="w-3 h-3 text-destructive absolute -top-1 -right-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{task.destination}</span>
                    {task.floor && (
                      <span className="text-xs text-muted-foreground shrink-0">· {task.floor}</span>
                    )}
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
                  {task.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{task.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
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
