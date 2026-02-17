import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Search, Download, Trash2, Filter, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRobotStore } from '@/store/useRobotStore';

type LogLevel = 'all' | 'info' | 'warning' | 'error' | 'success';

const levelIcons = {
  info: <Info className="w-3 h-3 text-secondary" />,
  warning: <AlertTriangle className="w-3 h-3 text-warning" />,
  error: <XCircle className="w-3 h-3 text-destructive" />,
  success: <CheckCircle className="w-3 h-3 text-success" />,
};

const levelColors = {
  info: 'border-l-secondary',
  warning: 'border-l-warning',
  error: 'border-l-destructive',
  success: 'border-l-success',
};

const AdvancedLogs = () => {
  const { t } = useTranslation();
  const { logs, clearLogs } = useRobotStore();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (levelFilter !== 'all' && log.type !== levelFilter) return false;
      if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, search, levelFilter]);

  const exportLogs = () => {
    const data = filtered.map(l => `[${new Date(l.timestamp).toISOString()}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alphabot-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const levels: LogLevel[] = ['all', 'info', 'warning', 'error', 'success'];

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('advancedLogs.title')} />
      <div className="flex-1 p-4 space-y-3 flex flex-col">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('advancedLogs.search')} className="pl-9 text-sm" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          {levels.map(level => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                levelFilter === level
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {t(`advancedLogs.levels.${level}`)}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{filtered.length} {t('advancedLogs.entries')}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={exportLogs} className="gap-1">
              <Download className="w-3 h-3" /> {t('advancedLogs.export')}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearLogs} className="gap-1 text-destructive">
              <Trash2 className="w-3 h-3" /> {t('advancedLogs.clear')}
            </Button>
          </div>
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`p-2 rounded-lg bg-card border-l-4 ${levelColors[log.type]} text-xs`}
            >
              <div className="flex items-center gap-1.5">
                {levelIcons[log.type]}
                <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-foreground mt-0.5 break-all">{log.message}</p>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">{t('advancedLogs.noLogs')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdvancedLogs;
