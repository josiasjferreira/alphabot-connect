/**
 * SlamEventAudio.tsx
 * Monitora eventos SLAMWARE em tempo real via AudioService singleton.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2, VolumeX, Play, Square, Wifi, WifiOff,
  Battery, AlertTriangle, CheckCircle, Zap, MapPin,
  ChevronDown, ChevronUp, Settings2, Radio,
} from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { audioService } from '@/services/audioService';

const SLAM_BASE = 'http://192.168.99.2:1445';
const POLL_MS = 2_000;
const MAX_EVENTS = 10;

// ─── Event → Speech mapping ────────────────────────────────────────
interface EventMapping {
  match: (evt: SlamEvent) => boolean;
  phrase: string;
  emoji: string;
  label: string;
}

const EVENT_MAP: EventMapping[] = [
  { match: (e) => !!(e.type?.includes('power_low') || e.event_type?.includes('power_low')), phrase: 'Bateria abaixo de 15%, por favor me leve ao carregador.', emoji: '🔋', label: 'Bateria Baixa' },
  { match: (e) => !!(e.type?.includes('bumper') || e.event_type?.includes('bumper')), phrase: 'Senti um impacto, verificando obstáculo.', emoji: '🚧', label: 'Obstáculo' },
  { match: (e) => !!(e.type?.includes('cliff') || e.event_type?.includes('cliff')), phrase: 'Detectei um degrau, parando por segurança.', emoji: '🚧', label: 'Degrau' },
  { match: (e) => !!(e.type?.includes('arrived') || e.event_type?.includes('arrived')), phrase: 'Entrega concluída. Obrigado!', emoji: '✅', label: 'Chegada' },
  { match: (e) => !!(e.type?.includes('pickup_done') || e.event_type?.includes('pickup_done')), phrase: 'Item coletado, seguindo para entrega.', emoji: '📦', label: 'Coleta' },
  { match: (e) => !!(e.type?.includes('charging') || e.event_type?.includes('charging')), phrase: 'Conectado ao carregador. Recarregando.', emoji: '⚡', label: 'Carregando' },
];

interface SlamEvent { type?: string; event_type?: string; [key: string]: unknown; }
interface ParsedEvent { id: number; raw: SlamEvent; timestamp: Date; phrase: string; emoji: string; label: string; }

const SlamEventAudio = () => {
  const [polling, setPolling] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [useMqtt, setUseMqtt] = useState(true);
  const [volume, setVolumeLocal] = useState(audioService.volume);
  const [mqttOnline, setMqttOnline] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef(0);

  // Subscribe to AudioService state
  useEffect(() => {
    return audioService.subscribe((state) => {
      setMqttOnline(state.mqttOnline);
      setIsPlaying(state.isPlaying);
      setVolumeLocal(state.volume);
    });
  }, []);

  const speak = useCallback((text: string) => { audioService.speak(text); }, []);
  const setVolume = useCallback((n: number) => { audioService.setVolume(n); }, []);
  const stopAudio = useCallback(() => { audioService.stop(); }, []);

  const parseEvent = useCallback((raw: SlamEvent): ParsedEvent => {
    const mapping = EVENT_MAP.find(m => m.match(raw));
    return {
      id: ++idRef.current, raw, timestamp: new Date(),
      phrase: mapping?.phrase ?? `Evento desconhecido: ${raw.type ?? raw.event_type ?? 'N/A'}`,
      emoji: mapping?.emoji ?? '❓', label: mapping?.label ?? 'Desconhecido',
    };
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${SLAM_BASE}/api/platform/v1/events`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return;
      const data = await res.json();
      const list: SlamEvent[] = Array.isArray(data) ? data : data.events ?? [];
      if (list.length === 0) return;
      const parsed = list.map(parseEvent);
      setEvents(prev => [...parsed, ...prev].slice(0, MAX_EVENTS));
      if (autoSpeak) for (const p of parsed) speak(p.phrase);
    } catch { /* SLAM offline */ }
  }, [parseEvent, autoSpeak, speak]);

  const startPolling = useCallback(() => {
    if (timerRef.current) return;
    setPolling(true);
    fetchEvents();
    timerRef.current = setInterval(fetchEvents, POLL_MS);
  }, [fetchEvents]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setPolling(false);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const simulate = useCallback((type: string) => {
    const raw: SlamEvent = { type, timestamp: Date.now() };
    const parsed = parseEvent(raw);
    setEvents(prev => [parsed, ...prev].slice(0, MAX_EVENTS));
    speak(parsed.phrase);
  }, [parseEvent, speak]);

  const speakPosition = useCallback(async () => {
    try {
      const res = await fetch(`${SLAM_BASE}/api/core/system/v1/robot/info`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error('offline');
      const data = await res.json();
      const loc = data.localization ?? data;
      speak(`Posição atual: ${(loc.x ?? 0).toFixed(1)} metros, ${(loc.y ?? 0).toFixed(1)} metros. Qualidade: ${loc.quality ?? 0}%.`);
    } catch { speak('Não foi possível obter a posição. SLAMWARE offline.'); }
  }, [speak]);

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title="🔊 Áudio Autônomo SLAMWARE" />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={polling ? 'default' : 'secondary'} className="text-[10px]">
              <Radio className={`w-3 h-3 mr-1 ${polling ? 'animate-pulse' : ''}`} />
              {polling ? 'Polling ativo (2s)' : 'Parado'}
            </Badge>
            <Badge variant={mqttOnline ? 'default' : 'destructive'} className="text-[10px]">
              {mqttOnline ? <><Wifi className="w-3 h-3 mr-1" />MQTT</> : <><WifiOff className="w-3 h-3 mr-1" />Offline</>}
            </Badge>
            {isPlaying && (
              <Badge variant="secondary" className="text-[10px] animate-pulse bg-success/20 text-success border-success/30">
                🔊 Falando
              </Badge>
            )}
          </div>
        </div>

        {/* Events Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" />
              Eventos em Tempo Real
              <span className="ml-auto text-[10px] text-muted-foreground font-normal">{events.length} evento(s)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum evento recebido. Inicie o polling ou simule um evento.</p>
              ) : (
                <AnimatePresence initial={false}>
                  {events.map((evt) => (
                    <motion.div key={evt.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="border-b border-border last:border-0 py-2">
                      <div className="flex items-start gap-2">
                        <span className="text-lg flex-shrink-0">{evt.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">{evt.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{evt.timestamp.toLocaleTimeString('pt-BR')}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{evt.phrase}</p>
                          <Collapsible open={expandedId === evt.id} onOpenChange={(o) => setExpandedId(o ? evt.id : null)}>
                            <CollapsibleTrigger asChild>
                              <button className="text-[10px] text-primary flex items-center gap-1 mt-1 hover:underline">
                                {expandedId === evt.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                JSON bruto
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <pre className="text-[10px] bg-muted/50 rounded p-2 mt-1 overflow-x-auto text-muted-foreground">
                                {JSON.stringify(evt.raw, null, 2)}
                              </pre>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Control Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Play className="w-4 h-4 text-primary" /> Controle Manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Button size="sm" onClick={polling ? stopPolling : startPolling} variant={polling ? 'destructive' : 'default'}>
                {polling ? <><Square className="w-4 h-4 mr-1" /> Parar Polling</> : <><Play className="w-4 h-4 mr-1" /> Iniciar Polling</>}
              </Button>
              {isPlaying && (
                <Button size="sm" variant="outline" onClick={stopAudio}><VolumeX className="w-4 h-4 mr-1" /> Parar Áudio</Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Fala automática</span>
              <Switch checked={autoSpeak} onCheckedChange={setAutoSpeak} />
            </div>
          </CardContent>
        </Card>

        {/* Voice Settings Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" /> Configurações de Voz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Saída de áudio</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Web Speech</span>
                <Switch checked={useMqtt} onCheckedChange={setUseMqtt} />
                <span className="text-[10px] text-muted-foreground">MQTT</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <Slider value={[volume]} onValueChange={v => setVolume(v[0])} min={0} max={100} step={5} className="flex-1" />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-mono w-10 text-right text-foreground">{volume}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Idioma: pt-BR (fixo) • {useMqtt ? 'MQTT ws://192.168.99.100:9002' : 'Web Speech API local'}</p>
          </CardContent>
        </Card>

        {/* Quick Test Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Teste Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => simulate('power_low')}>🔋 Simular Bateria Baixa</Button>
              <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => simulate('bumper')}>🚧 Simular Obstáculo</Button>
              <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => simulate('arrived')}>✅ Simular Chegada</Button>
              <Button variant="outline" size="sm" className="text-xs justify-start" onClick={() => speakPosition()}>
                <MapPin className="w-3 h-3 mr-1" /> Falar Posição Atual
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground pb-2">AlphaBot Connect v3.1.7 • Iascom 2026</p>
      </div>
    </div>
  );
};

export default SlamEventAudio;
