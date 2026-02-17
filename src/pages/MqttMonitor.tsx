import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Radio, Wifi, WifiOff, Send, Trash2 } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MqttMessage {
  id: string;
  topic: string;
  payload: string;
  timestamp: Date;
  direction: 'in' | 'out';
}

const MqttMonitor = () => {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [broker, setBroker] = useState('mqtt://192.168.99.2:1883');
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [pubTopic, setPubTopic] = useState('robot/cmd');
  const [pubPayload, setPubPayload] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const toggleConnection = () => {
    setConnected(prev => !prev);
    if (!connected) {
      // Simulate incoming messages
      simulateMessages();
    }
  };

  const simulateMessages = () => {
    const topics = ['robot/status', 'robot/battery', 'robot/sensors/temp', 'robot/position'];
    let count = 0;
    const interval = setInterval(() => {
      if (count >= 5) { clearInterval(interval); return; }
      setMessages(prev => [{
        id: Date.now().toString(),
        topic: topics[Math.floor(Math.random() * topics.length)],
        payload: JSON.stringify({ value: Math.round(Math.random() * 100), ts: Date.now() }),
        timestamp: new Date(),
        direction: 'in' as const,
      }, ...prev].slice(0, 50));
      count++;
    }, 2000);
  };

  const publish = () => {
    if (!pubPayload.trim()) return;
    setMessages(prev => [{
      id: Date.now().toString(),
      topic: pubTopic,
      payload: pubPayload,
      timestamp: new Date(),
      direction: 'out' as const,
    }, ...prev].slice(0, 50));
    setPubPayload('');
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title={t('mqtt.title')} />
      <div className="flex-1 p-4 space-y-4 flex flex-col">
        {/* Connection */}
        <div className="p-3 rounded-xl bg-card border border-border shadow-card space-y-2">
          <div className="flex items-center gap-2">
            {connected ? <Wifi className="w-4 h-4 text-success" /> : <WifiOff className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm font-semibold text-foreground">{t('mqtt.broker')}</span>
          </div>
          <Input value={broker} onChange={e => setBroker(e.target.value)} disabled={connected} className="text-xs" />
          <Button onClick={toggleConnection} variant={connected ? 'destructive' : 'default'} className="w-full" size="sm">
            {connected ? t('mqtt.disconnect') : t('mqtt.connect')}
          </Button>
        </div>

        {/* Publish */}
        {connected && (
          <div className="p-3 rounded-xl bg-card border border-border shadow-card space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t('mqtt.publish')}</p>
            <Input value={pubTopic} onChange={e => setPubTopic(e.target.value)} placeholder="Topic" className="text-xs" />
            <div className="flex gap-2">
              <Input value={pubPayload} onChange={e => setPubPayload(e.target.value)} placeholder="Payload" className="text-xs" onKeyDown={e => e.key === 'Enter' && publish()} />
              <Button size="icon" onClick={publish}><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">{t('mqtt.messages')} ({messages.length})</p>
          <Button size="sm" variant="ghost" onClick={() => setMessages([])}><Trash2 className="w-3 h-3" /></Button>
        </div>
        <div ref={logRef} className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.direction === 'in' ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-2 rounded-lg text-xs font-mono ${
                msg.direction === 'in' ? 'bg-muted' : 'bg-primary/10'
              }`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Radio className={`w-3 h-3 ${msg.direction === 'in' ? 'text-success' : 'text-primary'}`} />
                <span className="font-semibold text-foreground">{msg.topic}</span>
                <span className="ml-auto text-muted-foreground">{msg.timestamp.toLocaleTimeString()}</span>
              </div>
              <p className="text-muted-foreground break-all">{msg.payload}</p>
            </motion.div>
          ))}
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">{t('mqtt.noMessages')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MqttMonitor;
