import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Play, RotateCcw, CheckCircle2, XCircle, Loader2,
  Wifi, Globe, Radio, Zap, Server, Thermometer, Battery, Eye,
  Share2, WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ROBOT_NETWORK_CONFIG } from '@/services/RobotWiFiConnection';

// ─── Endpoint definitions ───────────────────────────────────────────────────

// CRÍTICO: porta 80 EXPLÍCITA — tablet responde em :80 mas não no padrão implícito
const BASE = `http://${ROBOT_NETWORK_CONFIG.router}:${ROBOT_NETWORK_CONFIG.ports.http}`;

interface EndpointDef {
  id: string;
  label: string;
  path: string;
  method: 'GET' | 'POST';
  icon: React.ReactNode;
  category: string;
  body?: unknown;
}

const ENDPOINTS: EndpointDef[] = [
  { id: 'ping',        label: 'Ping',             path: '/api/ping',              method: 'GET',  icon: <Zap className="w-4 h-4" />,         category: 'Sistema' },
  { id: 'status',      label: 'Status',            path: '/api/status',            method: 'GET',  icon: <Server className="w-4 h-4" />,      category: 'Sistema' },
  { id: 'sensors_all', label: 'Sensores (todos)',  path: '/api/sensors/all',       method: 'GET',  icon: <Radio className="w-4 h-4" />,       category: 'Sensores' },
  { id: 'sensor_imu',  label: 'IMU',               path: '/api/sensors/imu',       method: 'GET',  icon: <Radio className="w-4 h-4" />,       category: 'Sensores' },
  { id: 'sensor_lidar',label: 'LiDAR',             path: '/api/sensors/lidar',     method: 'GET',  icon: <Eye className="w-4 h-4" />,         category: 'Sensores' },
  { id: 'sensor_bat',  label: 'Bateria',           path: '/api/sensors/battery',   method: 'GET',  icon: <Battery className="w-4 h-4" />,     category: 'Sensores' },
  { id: 'sensor_temp', label: 'Temperatura',       path: '/api/sensors/temperature',method: 'GET', icon: <Thermometer className="w-4 h-4" />, category: 'Sensores' },
  { id: 'calib_state', label: 'Estado Calibração', path: '/api/calibration/state', method: 'GET',  icon: <Globe className="w-4 h-4" />,       category: 'Calibração' },
  { id: 'calib_data',  label: 'Dados Calibração',  path: '/api/calibration/data',  method: 'GET',  icon: <Globe className="w-4 h-4" />,       category: 'Calibração' },
  { id: 'movement',    label: 'Status Movimento',  path: '/api/movement/status',   method: 'GET',  icon: <Wifi className="w-4 h-4" />,        category: 'Controle' },
  { id: 'logs',        label: 'Logs Recentes',     path: '/api/logs/recent',       method: 'GET',  icon: <Server className="w-4 h-4" />,      category: 'Sistema' },
];

const WS_URL   = `ws://${ROBOT_NETWORK_CONFIG.router}:${ROBOT_NETWORK_CONFIG.ports.ws}`;
const MQTT_URL = `ws://${ROBOT_NETWORK_CONFIG.router}:${ROBOT_NETWORK_CONFIG.ports.mqtt}`;

// ─── Result types ────────────────────────────────────────────────────────────

interface EndpointResult {
  id: string;
  status: 'idle' | 'loading' | 'ok' | 'error';
  httpStatus: number | null;
  ms: number | null;
  preview: string | null;
  error: string | null;
}

interface WsResult {
  status: 'idle' | 'loading' | 'ok' | 'error';
  ms: number | null;
  message: string | null;
}

const initResults = (): Record<string, EndpointResult> =>
  Object.fromEntries(ENDPOINTS.map(e => [e.id, { id: e.id, status: 'idle', httpStatus: null, ms: null, preview: null, error: null }]));

// ─── Component ───────────────────────────────────────────────────────────────

const NetworkDiagnostics = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState<Record<string, EndpointResult>>(initResults());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullResponse, setFullResponse] = useState<Record<string, string>>({});
  const [wsResult, setWsResult]     = useState<WsResult>({ status: 'idle', ms: null, message: null });
  const [mqttResult, setMqttResult] = useState<WsResult>({ status: 'idle', ms: null, message: null });
  const wsTestRef   = useRef<WebSocket | null>(null);
  const mqttTestRef = useRef<WebSocket | null>(null);

  const updateResult = useCallback((id: string, patch: Partial<EndpointResult>) => {
    setResults(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const testEndpoint = useCallback(async (ep: EndpointDef): Promise<void> => {
    updateResult(ep.id, { status: 'loading', httpStatus: null, ms: null, preview: null, error: null });
    const url = `${BASE}${ep.path}`;
    const start = performance.now();
    try {
      const res = await fetch(url, {
        method: ep.method,
        headers: { Accept: 'application/json', ...(ep.body ? { 'Content-Type': 'application/json' } : {}) },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      });
      const ms = Math.round(performance.now() - start);
      let text = '';
      try { text = await res.text(); } catch { /* noop */ }

      let preview = '';
      try {
        const json = JSON.parse(text);
        preview = JSON.stringify(json).slice(0, 120);
      } catch {
        preview = text.slice(0, 120);
      }

      setFullResponse(prev => ({ ...prev, [ep.id]: text || '(vazio)' }));
      updateResult(ep.id, {
        status: res.ok ? 'ok' : 'error',
        httpStatus: res.status,
        ms,
        preview: preview || '(vazio)',
        error: res.ok ? null : `HTTP ${res.status}`,
      });
    } catch (err: any) {
      const ms = Math.round(performance.now() - start);
      updateResult(ep.id, {
        status: 'error',
        httpStatus: null,
        ms,
        preview: null,
        error: err.name === 'TimeoutError' ? 'Timeout (6s)' : err.message,
      });
    }
  }, [updateResult]);

  const testWebSocket = useCallback(() => {
    setWsResult({ status: 'loading', ms: null, message: null });
    wsTestRef.current?.close();
    const start = performance.now();
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        wsTestRef.current?.close();
        setWsResult({ status: 'error', ms: Math.round(performance.now() - start), message: 'Timeout (6s) — sem resposta' });
      }
    }, 6000);

    try {
      const ws = new WebSocket(WS_URL);
      wsTestRef.current = ws;

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const ms = Math.round(performance.now() - start);
        setWsResult({ status: 'ok', ms, message: `Conexão estabelecida em ${ms}ms` });
        ws.close();
      };

      ws.onerror = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        setWsResult({ status: 'error', ms: Math.round(performance.now() - start), message: 'Erro de conexão — verifique se o serviço WS está ativo' });
      };

      ws.onclose = (e) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          setWsResult({ status: 'error', ms: Math.round(performance.now() - start), message: `Conexão fechada (código ${e.code})` });
        }
      };
    } catch (err: any) {
      clearTimeout(timeout);
      setWsResult({ status: 'error', ms: Math.round(performance.now() - start), message: err.message });
    }
  }, []);

  const testMqtt = useCallback(() => {
    setMqttResult({ status: 'loading', ms: null, message: null });
    mqttTestRef.current?.close();
    const start = performance.now();
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        mqttTestRef.current?.close();
        setMqttResult({ status: 'error', ms: Math.round(performance.now() - start), message: 'Timeout (6s) — broker MQTT não respondeu' });
      }
    }, 6000);

    try {
      const ws = new WebSocket(MQTT_URL);
      mqttTestRef.current = ws;

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const ms = Math.round(performance.now() - start);
        setMqttResult({ status: 'ok', ms, message: `Bridge MQTT conectado em ${ms}ms` });
        ws.close();
      };

      ws.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        setMqttResult({ status: 'error', ms: Math.round(performance.now() - start), message: 'Erro de conexão — verifique se o bridge MQTT está ativo' });
      };

      ws.onclose = (e) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          setMqttResult({ status: 'error', ms: Math.round(performance.now() - start), message: `Conexão fechada (código ${e.code})` });
        }
      };
    } catch (err: any) {
      clearTimeout(timeout);
      setMqttResult({ status: 'error', ms: Math.round(performance.now() - start), message: err.message });
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setResults(initResults());
    setFullResponse({});
    setWsResult({ status: 'idle', ms: null, message: null });
    setMqttResult({ status: 'idle', ms: null, message: null });

    for (let i = 0; i < ENDPOINTS.length; i++) {
      await testEndpoint(ENDPOINTS[i]);
      setProgress(Math.round(((i + 1) / ENDPOINTS.length) * 100));
    }

    setRunning(false);
  }, [testEndpoint]);

  const reset = useCallback(() => {
    setResults(initResults());
    setProgress(0);
    setFullResponse({});
    setExpandedId(null);
    setWsResult({ status: 'idle', ms: null, message: null });
    setMqttResult({ status: 'idle', ms: null, message: null });
  }, []);

  const shareReport = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE,
      wsUrl: WS_URL,
      mqttUrl: MQTT_URL,
      network: ROBOT_NETWORK_CONFIG,
      websocket: wsResult,
      mqtt: mqttResult,
      endpoints: ENDPOINTS.map(ep => {
        const r = results[ep.id];
        return {
          id: ep.id,
          label: ep.label,
          path: ep.path,
          method: ep.method,
          status: r.status,
          httpStatus: r.httpStatus,
          ms: r.ms,
          error: r.error,
          preview: r.preview,
          fullResponse: fullResponse[ep.id] ?? null,
        };
      }),
    };

    const text = JSON.stringify(report, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostico-rede-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, fullResponse, wsResult, mqttResult]);

  const categories = [...new Set(ENDPOINTS.map(e => e.category))];
  const okCount = Object.values(results).filter(r => r.status === 'ok').length;
  const errCount = Object.values(results).filter(r => r.status === 'error').length;
  const doneCount = okCount + errCount;
  const hasAnyResult = doneCount > 0 || wsResult.status !== 'idle' || mqttResult.status !== 'idle';

  const statusIcon = (r: EndpointResult) => {
    if (r.status === 'loading') return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    if (r.status === 'ok')      return <CheckCircle2 className="w-4 h-4 text-success" />;
    if (r.status === 'error')   return <XCircle className="w-4 h-4 text-destructive" />;
    return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
  };

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted active:bg-muted/80">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">🔬 Diagnóstico de Rede</h1>
            <p className="text-xs text-muted-foreground">Port Forwarding • {BASE}</p>
          </div>
          {doneCount > 0 && (
            <div className="flex gap-1 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-success/10 text-success font-bold">{okCount}✓</span>
              {errCount > 0 && <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-bold">{errCount}✗</span>}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Network config info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-primary mb-2">📡 Configuração de Rede (Port Forwarding)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div className="text-muted-foreground">Roteador (Tenda):</div>
              <div className="font-mono text-foreground">{ROBOT_NETWORK_CONFIG.router}</div>
              <div className="text-muted-foreground">Tablet:</div>
              <div className="font-mono text-foreground">{ROBOT_NETWORK_CONFIG.tablet}</div>
              <div className="text-muted-foreground">Robô (interno):</div>
              <div className="font-mono text-foreground">{ROBOT_NETWORK_CONFIG.robotInternal}</div>
              <div className="text-muted-foreground">HTTP (porta {ROBOT_NETWORK_CONFIG.ports.http} padrão):</div>
              <div className="font-mono text-foreground">{ROBOT_NETWORK_CONFIG.router} → {ROBOT_NETWORK_CONFIG.tablet}:80</div>
              <div className="text-muted-foreground">MQTT (porta {ROBOT_NETWORK_CONFIG.ports.mqtt}):</div>
              <div className="font-mono text-foreground">{ROBOT_NETWORK_CONFIG.router}:{ROBOT_NETWORK_CONFIG.ports.mqtt} → {ROBOT_NETWORK_CONFIG.tablet}:{ROBOT_NETWORK_CONFIG.ports.mqtt}</div>
              <div className="text-muted-foreground">WebSocket (porta {ROBOT_NETWORK_CONFIG.ports.ws}):</div>
              <div className="font-mono text-foreground">{ROBOT_NETWORK_CONFIG.router}:{ROBOT_NETWORK_CONFIG.ports.ws} → {ROBOT_NETWORK_CONFIG.tablet}:{ROBOT_NETWORK_CONFIG.ports.ws}</div>
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex gap-2">
          <Button onClick={runAll} disabled={running} className="flex-1 gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? `Testando... ${progress}%` : 'Testar Endpoints HTTP'}
          </Button>
          <Button onClick={reset} variant="outline" size="icon" disabled={running}>
            <RotateCcw className="w-4 h-4" />
          </Button>
          {hasAnyResult && (
            <Button onClick={shareReport} variant="outline" size="icon" title="Compartilhar Relatório">
              <Share2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Progress */}
        {running && (
          <Card className="border-primary/30">
            <CardContent className="p-3 space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-[10px] text-center text-muted-foreground">{doneCount} / {ENDPOINTS.length} endpoints testados</p>
            </CardContent>
          </Card>
        )}

        {/* WebSocket Test */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">WebSocket</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${wsResult.status === 'ok' ? 'bg-success/10' : wsResult.status === 'error' ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Conexão WebSocket</span>
                    {wsResult.ms != null && (
                      <span className="text-[10px] text-muted-foreground font-mono">{wsResult.ms}ms</span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{WS_URL}</p>
                  {wsResult.message && (
                    <p className={`text-[10px] mt-0.5 ${wsResult.status === 'ok' ? 'text-success' : 'text-destructive'}`}>
                      {wsResult.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testWebSocket}
                    disabled={wsResult.status === 'loading'}
                    className="text-xs gap-1 shrink-0"
                  >
                    {wsResult.status === 'loading'
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <WifiOff className="w-3 h-3" />}
                    Testar WS
                  </Button>
                  {wsResult.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {wsResult.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {wsResult.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                  {wsResult.status === 'idle' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MQTT Test */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">MQTT Bridge</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${mqttResult.status === 'ok' ? 'bg-success/10' : mqttResult.status === 'error' ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                  <Radio className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Bridge MQTT</span>
                    {mqttResult.ms != null && (
                      <span className="text-[10px] text-muted-foreground font-mono">{mqttResult.ms}ms</span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{MQTT_URL}</p>
                  {mqttResult.message && (
                    <p className={`text-[10px] mt-0.5 ${mqttResult.status === 'ok' ? 'text-success' : 'text-destructive'}`}>
                      {mqttResult.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={testMqtt}
                    disabled={mqttResult.status === 'loading'}
                    className="text-xs gap-1 shrink-0"
                  >
                    {mqttResult.status === 'loading'
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Radio className="w-3 h-3" />}
                    Testar MQTT
                  </Button>
                  {mqttResult.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {mqttResult.status === 'ok' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {mqttResult.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                  {mqttResult.status === 'idle' && <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results by category */}
        {categories.map(cat => {
          const catEndpoints = ENDPOINTS.filter(e => e.category === cat);
          return (
            <Card key={cat}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">{cat}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {catEndpoints.map((ep, idx) => {
                  const r = results[ep.id];
                  const isExpanded = expandedId === ep.id;
                  const hasFull = !!fullResponse[ep.id];
                  return (
                    <div key={ep.id} className={`px-4 py-3 ${idx < catEndpoints.length - 1 ? 'border-b border-border' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${r.status === 'ok' ? 'bg-success/10' : r.status === 'error' ? 'bg-destructive/10' : 'bg-muted/50'}`}>
                          {ep.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{ep.label}</span>
                            {r.httpStatus != null && (
                              <Badge variant={r.status === 'ok' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 font-mono">
                                {r.httpStatus}
                              </Badge>
                            )}
                            {r.ms != null && (
                              <span className="text-[10px] text-muted-foreground font-mono">{r.ms}ms</span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{ep.path}</p>
                          {r.status === 'error' && r.error && (
                            <p className="text-[10px] text-destructive mt-0.5">{r.error}</p>
                          )}
                          {r.preview && r.status === 'ok' && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.preview}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasFull && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : ep.id)}
                              className="text-[10px] text-primary font-medium"
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                          {statusIcon(r)}
                        </div>
                      </div>

                      {/* Expanded response */}
                      <AnimatePresence>
                        {isExpanded && hasFull && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <pre className="mt-2 text-[10px] font-mono bg-muted/30 rounded-lg p-3 max-h-48 overflow-auto text-muted-foreground whitespace-pre-wrap break-all">
                              {(() => {
                                try { return JSON.stringify(JSON.parse(fullResponse[ep.id]), null, 2); }
                                catch { return fullResponse[ep.id]; }
                              })()}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* Summary */}
        {doneCount === ENDPOINTS.length && !running && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={okCount > 0 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}>
              <CardContent className="p-4 text-center space-y-2">
                <p className="text-2xl">{okCount > 0 ? '✅' : '❌'}</p>
                <p className="text-sm font-bold text-foreground">
                  {okCount} de {ENDPOINTS.length} endpoints acessíveis
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {okCount === 0
                    ? 'Verifique se o tablet está ligado e conectado à rede do roteador'
                    : errCount > 0
                      ? `${errCount} endpoint(s) falharam — podem não estar implementados no firmware`
                      : 'Todos os endpoints responderam com sucesso!'}
                </p>
                <Button onClick={shareReport} variant="outline" size="sm" className="gap-2 w-full">
                  <Share2 className="w-4 h-4" />
                  Compartilhar Relatório (.json)
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <p className="text-[10px] text-center text-muted-foreground pb-4">
          AlphaBot Companion v2.1.0 • Iascom
        </p>
      </div>
    </div>
  );
};

export default NetworkDiagnostics;

