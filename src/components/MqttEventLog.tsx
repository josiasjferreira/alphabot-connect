import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useMQTT } from '@/hooks/useMQTT';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Radio, Trash2, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface MqttEvent {
  id: number;
  topic: string;
  payload: string;
  type: 'control' | 'telemetry' | 'status' | 'other';
  ts: number;
}

function classifyTopic(topic: string): MqttEvent['type'] {
  if (topic.includes('control') || topic.includes('cmd') || topic.includes('movement')) return 'control';
  if (topic.includes('telemetry') || topic.includes('sensor')) return 'telemetry';
  if (topic.includes('status') || topic.includes('heartbeat')) return 'status';
  return 'other';
}

const TYPE_COLORS: Record<MqttEvent['type'], string> = {
  control: 'bg-primary/10 text-primary border-l-primary',
  telemetry: 'bg-secondary/10 text-secondary border-l-secondary',
  status: 'bg-success/10 text-success border-l-success',
  other: 'bg-muted text-muted-foreground border-l-muted-foreground',
};

const TYPE_LABELS: Record<MqttEvent['type'], string> = {
  control: 'CTL',
  telemetry: 'TEL',
  status: 'STS',
  other: '···',
};

const MqttEventLog = () => {
  const { isConnected, lastTopic, messageCount } = useMQTT();
  const [events, setEvents] = useState<MqttEvent[]>([]);
  const [filter, setFilter] = useState<MqttEvent['type'] | 'all'>('all');
  const [expanded, setExpanded] = useState(false);
  const idRef = useRef(0);
  const prevCountRef = useRef(messageCount);

  // Capture new messages
  useEffect(() => {
    if (messageCount > prevCountRef.current && lastTopic) {
      idRef.current++;
      const newEvent: MqttEvent = {
        id: idRef.current,
        topic: lastTopic,
        payload: '',
        type: classifyTopic(lastTopic),
        ts: Date.now(),
      };
      setEvents(prev => [newEvent, ...prev].slice(0, 50));
    }
    prevCountRef.current = messageCount;
  }, [messageCount, lastTopic]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => e.type === filter);
  }, [events, filter]);

  const filters: Array<MqttEvent['type'] | 'all'> = ['all', 'control', 'telemetry', 'status', 'other'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Radio className="w-4 h-4 text-secondary" />
          Log MQTT
          <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
            {events.length}
          </span>
          {isConnected && (
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          )}
        </h2>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground" />
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f === 'all' ? 'Todos' : TYPE_LABELS[f]}
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-5 px-1.5 text-destructive"
              onClick={() => setEvents([])}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          {/* Events */}
          <ScrollArea className="h-48">
            <div className="space-y-1 pr-2">
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {isConnected ? 'Aguardando mensagens MQTT…' : 'MQTT desconectado'}
                </p>
              )}
              {filtered.map(ev => (
                <div
                  key={ev.id}
                  className={`px-2 py-1.5 rounded-lg border-l-2 text-[10px] font-mono ${TYPE_COLORS[ev.type]}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">[{TYPE_LABELS[ev.type]}]</span>
                    <span className="text-muted-foreground">
                      {new Date(ev.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="truncate mt-0.5 opacity-80">{ev.topic}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  );
};

export default MqttEventLog;
