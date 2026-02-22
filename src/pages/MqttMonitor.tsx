import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Wifi, WifiOff, Send, Trash2, ChevronLeft, Filter, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ROBOT_NETWORK_CONFIG } from '@/services/RobotWiFiConnection';

// ─── Constants ───────────────────────────────────────────────────────────────

const MQTT_WS_URL = `ws://${ROBOT_NETWORK_CONFIG.router}:${ROBOT_NETWORK_CONFIG.ports.mqtt}`;
const RECONNECT_DELAY = 3000;
const MAX_MESSAGES = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface MqttMessage {
  id: string;
  topic: string;
  payload: string;
  timestamp: Date;
  direction: 'in' | 'out';
  size: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const MqttMonitor = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [connState, setConnState] = useState<ConnState>('disconnected');
  const [connError, setConnError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [filterTopic, setFilterTopic] = useState('');
  const [pubTopic, setPubTopic] = useState('robot/cmd');
  const [pubPayload, setPubPayload] = useState('{"cmd":"ping"}');
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>(['robot/#', 'sensor/#']);
  const [newSubTopic, setNewSubTopic] = useState('');
  const [showSubPanel, setShowSubPanel] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingStartRef = useRef<number>(0);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [messages]);

  // Cleanup
  useEffect(() => () => {
    wsRef.current?.close();
    if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
  }, []);

  const addMessage = useCallback((msg: Omit<MqttMessage, 'id' | 'size'>) => {
    setMessages(prev => [{
      ...msg,
      id: `${Date.now()}-${Math.random()}`,
      size: new TextEncoder().encode(msg.payload).length,
    }, ...prev].slice(0, MAX_MESSAGES));
  }, []);

  // ─── WebSocket MQTT connection ────────────────────────────────────────────

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    wsRef.current?.close();
    setConnState('connecting');
    setConnError(null);

    console.log('🔌 Conectando MQTT via WebSocket:', MQTT_WS_URL);

    try {
      // Try MQTT over WebSocket (protocol: 'mqtt' or 'mqttv3.1')
      const ws = new WebSocket(MQTT_WS_URL, ['mqtt', 'mqttv3.1']);
      wsRef.current = ws;

      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          setConnState('error');
          setConnError(`Timeout ao conectar em ${MQTT_WS_URL}`);
        }
      }, 8000);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        console.log('✅ WebSocket MQTT conectado:', MQTT_WS_URL);
        setConnState('connected');
        setConnError(null);
        toast({ title: '✅ MQTT Conectado', description: MQTT_WS_URL });

        // Measure latency via ping
        pingStartRef.current = performance.now();
        pingTimerRef.current = setTimeout(() => {
          setLatencyMs(null); // pong not received
        }, 3000);
      };

      ws.onmessage = (event) => {
        const now = performance.now();
        // Measure latency from first message (pong)
        if (pingStartRef.current > 0) {
          setLatencyMs(Math.round(now - pingStartRef.current));
          pingStartRef.current = 0;
          if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
        }

        let payload = '';
        let topic = 'unknown';

        try {
          if (typeof event.data === 'string') {
            const parsed = JSON.parse(event.data);
            topic = parsed.topic ?? parsed.t ?? topic;
            payload = typeof parsed.payload === 'string'
              ? parsed.payload
              : JSON.stringify(parsed.payload ?? parsed.p ?? parsed);
          } else {
            payload = event.data.toString();
          }
        } catch {
          payload = typeof event.data === 'string' ? event.data : '[binary data]';
        }

        addMessage({ topic, payload, timestamp: new Date(), direction: 'in' });
      };

      ws.onerror = (e) => {
        clearTimeout(connectTimeout);
        console.error('❌ Erro WebSocket MQTT:', e);
        setConnState('error');
        setConnError(`Falha ao conectar em ${MQTT_WS_URL} — verifique se o broker MQTT está ativo (porta ${ROBOT_NETWORK_CONFIG.ports.mqtt})`);
      };

      ws.onclose = (e) => {
        clearTimeout(connectTimeout);
        console.log('🔌 WebSocket MQTT fechado, código:', e.code);
        if (connState === 'connected') {
          setConnState('disconnected');
          toast({ title: '🔴 MQTT Desconectado', variant: 'destructive' });
        } else {
          setConnState('error');
          setConnError(`Conexão recusada (código ${e.code}) — broker pode não aceitar WebSocket`);
        }
        setLatencyMs(null);
      };

    } catch (err: any) {
      setConnState('error');
      setConnError(err.message);
    }
  }, [addMessage, connState, toast]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnState('disconnected');
    setConnError(null);
    setLatencyMs(null);
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
  }, []);

  // ─── Publish ─────────────────────────────────────────────────────────────

  const publish = useCallback(() => {
    if (!pubPayload.trim() || !pubTopic.trim()) return;

    const ws = wsRef.current;
    const isOpen = ws?.readyState === WebSocket.OPEN;

    // Always log outgoing in UI
    addMessage({ topic: pubTopic, payload: pubPayload, timestamp: new Date(), direction: 'out' });

    if (isOpen) {
      try {
        // Send as JSON envelope (broker-dependent protocol)
        ws!.send(JSON.stringify({ topic: pubTopic, payload: pubPayload, qos: 0, retain: false }));
        console.log('📤 Publicado:', pubTopic, pubPayload);
      } catch (err: any) {
        toast({ title: '❌ Falha ao publicar', description: err.message, variant: 'destructive' });
      }
    } else {
      toast({ title: '⚠️ Não conectado', description: 'Conecte ao broker MQTT primeiro', variant: 'destructive' });
    }

    setPubPayload('');
  }, [pubTopic, pubPayload, addMessage, toast]);

  // ─── Subscriptions ────────────────────────────────────────────────────────

  const addSubscription = () => {
    if (!newSubTopic.trim() || subscribedTopics.includes(newSubTopic.trim())) return;
    setSubscribedTopics(prev => [...prev, newSubTopic.trim()]);
    setNewSubTopic('');
  };

  const removeSubscription = (topic: string) => {
    setSubscribedTopics(prev => prev.filter(t => t !== topic));
  };

  // ─── Share report ─────────────────────────────────────────────────────────

  const shareReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      brokerUrl: MQTT_WS_URL,
      network: ROBOT_NETWORK_CONFIG,
      status: connState,
      latencyMs,
      subscribedTopics,
      messageCount: messages.length,
      messages: messages.slice(0, 50).map(m => ({
        topic: m.topic,
        payload: m.payload,
        direction: m.direction,
        timestamp: m.timestamp.toISOString(),
        sizeBytes: m.size,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mqtt-relatorio-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [connState, latencyMs, subscribedTopics, messages]);

  // ─── Filtered messages ────────────────────────────────────────────────────

  const filtered = filterTopic
    ? messages.filter(m => m.topic.toLowerCase().includes(filterTopic.toLowerCase()))
    : messages;

  const inCount  = messages.filter(m => m.direction === 'in').length;
  const outCount = messages.filter(m => m.direction === 'out').length;

  const stateColor: Record<ConnState, string> = {
    connected:    'bg-success text-success-foreground',
    connecting:   'bg-warning text-warning-foreground',
    error:        'bg-destructive text-destructive-foreground',
    disconnected: 'bg-muted text-muted-foreground',
  };

  const stateLabel: Record<ConnState, string> = {
    connected:    'Conectado',
    connecting:   'Conectando...',
    error:        'Erro',
    disconnected: 'Desconectado',
  };

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-muted active:bg-muted/80">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">📡 MQTT Monitor</h1>
            <p className="text-xs text-muted-foreground font-mono">{MQTT_WS_URL}</p>
          </div>
          <Badge className={`text-[10px] ${stateColor[connState]}`}>
            {connState === 'connected' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse inline-block" />}
            {stateLabel[connState]}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 p-4 min-h-0">

        {/* Connection Card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              {connState === 'connected'
                ? <Wifi className="w-4 h-4 text-success" />
                : <WifiOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm font-semibold text-foreground">Broker MQTT</span>
              {latencyMs != null && (
                <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-success/10 text-success">{latencyMs}ms</span>
              )}
            </div>

            <div className="text-[10px] font-mono text-muted-foreground space-y-0.5 p-2 rounded-lg bg-muted/30">
              <p>• Roteador: <span className="text-foreground">192.168.0.1</span></p>
              <p>• Porta MQTT-WS: <span className="text-foreground">{ROBOT_NETWORK_CONFIG.ports.mqtt}</span></p>
              <p>• URL: <span className="text-foreground">{MQTT_WS_URL}</span></p>
            </div>

            {connError && (
              <p className="text-[10px] text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-2">{connError}</p>
            )}

            <div className="flex gap-2">
              {connState !== 'connected' ? (
                <Button
                  onClick={connect}
                  disabled={connState === 'connecting'}
                  className="flex-1 gap-2"
                  size="sm"
                >
                  {connState === 'connecting'
                    ? <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> Conectando...</>
                    : <><Wifi className="w-4 h-4" /> Conectar</>}
                </Button>
              ) : (
                <Button onClick={disconnect} variant="destructive" className="flex-1 gap-2" size="sm">
                  <WifiOff className="w-4 h-4" /> Desconectar
                </Button>
              )}
              {messages.length > 0 && (
                <Button onClick={shareReport} variant="outline" size="icon" title="Exportar relatório">
                  <Share2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <button
              onClick={() => setShowSubPanel(!showSubPanel)}
              className="w-full flex items-center justify-between text-sm font-semibold text-foreground"
            >
              <span>🔔 Tópicos Assinados ({subscribedTopics.length})</span>
              <span className="text-xs text-muted-foreground">{showSubPanel ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            <AnimatePresence>
              {showSubPanel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 flex flex-wrap gap-1.5 mb-3">
                    {subscribedTopics.map(t => (
                      <span key={t} className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-medium">
                        {t}
                        <button onClick={() => removeSubscription(t)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newSubTopic}
                      onChange={e => setNewSubTopic(e.target.value)}
                      placeholder="Novo tópico (ex: robot/status)"
                      className="text-xs h-8"
                      onKeyDown={e => e.key === 'Enter' && addSubscription()}
                    />
                    <Button size="sm" onClick={addSubscription} className="shrink-0 h-8">Adicionar</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Publish */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Publicar Mensagem</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            <Input
              value={pubTopic}
              onChange={e => setPubTopic(e.target.value)}
              placeholder="Tópico"
              className="text-xs h-8 font-mono"
            />
            <div className="flex gap-2">
              <Input
                value={pubPayload}
                onChange={e => setPubPayload(e.target.value)}
                placeholder='Payload (ex: {"cmd":"ping"})'
                className="text-xs h-8 font-mono"
                onKeyDown={e => e.key === 'Enter' && publish()}
              />
              <Button size="icon" onClick={publish} className="shrink-0 h-8 w-8">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            {/* Quick commands */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: 'Ping', payload: '{"cmd":"ping"}', topic: 'robot/cmd' },
                { label: 'Status', payload: '{"cmd":"status"}', topic: 'robot/cmd' },
                { label: 'Stop', payload: '{"cmd":"stop"}', topic: 'robot/movement' },
                { label: 'Battery', payload: '{"cmd":"battery"}', topic: 'robot/sensors' },
              ].map(q => (
                <button
                  key={q.label}
                  onClick={() => { setPubTopic(q.topic); setPubPayload(q.payload); }}
                  className="px-2 py-0.5 text-[10px] rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={filterTopic}
              onChange={e => setFilterTopic(e.target.value)}
              placeholder="Filtrar por tópico..."
              className="text-xs h-8 pl-7"
            />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            <span className="text-success font-bold">↓{inCount}</span>
            {' / '}
            <span className="text-primary font-bold">↑{outCount}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setMessages([])} className="h-8 px-2">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div ref={logRef} className="flex-1 overflow-y-auto space-y-1.5 min-h-0 max-h-96">
          <AnimatePresence>
            {filtered.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: msg.direction === 'in' ? -8 : 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`p-2.5 rounded-lg text-[10px] font-mono border ${
                  msg.direction === 'in'
                    ? 'bg-success/5 border-success/20'
                    : 'bg-primary/5 border-primary/20'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Radio className={`w-3 h-3 shrink-0 ${msg.direction === 'in' ? 'text-success' : 'text-primary'}`} />
                  <span className="font-bold text-foreground flex-1 truncate">{msg.topic}</span>
                  <span className="text-muted-foreground">{msg.size}B</span>
                  <span className="text-muted-foreground">{msg.timestamp.toLocaleTimeString()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${msg.direction === 'in' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                    {msg.direction === 'in' ? '↓ IN' : '↑ OUT'}
                  </span>
                </div>
                <p className="text-muted-foreground break-all leading-relaxed">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(msg.payload), null, 2)
                        .split('\n').slice(0, 5).join('\n');
                    } catch {
                      return msg.payload;
                    }
                  })()}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <Radio className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {filterTopic ? `Nenhuma mensagem para "${filterTopic}"` : 'Nenhuma mensagem ainda'}
              </p>
              {connState !== 'connected' && (
                <p className="text-xs text-muted-foreground">Conecte ao broker para receber mensagens</p>
              )}
            </div>
          )}
        </div>

        <p className="text-[10px] text-center text-muted-foreground pb-2">
          AlphaBot Companion v2.1.1 • Iascom
        </p>
      </div>
    </div>
  );
};

export default MqttMonitor;
