import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Wifi, WifiOff, Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  Volume2, Monitor, Navigation, Clock, Send, ChevronDown, ChevronUp,
  Search, Radio
} from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NETWORK_CONFIG } from '@/config/mqtt';

const BOARD_IP = NETWORK_CONFIG.ANDROID_BOARD_IP;
const BASE_URL = `http://${BOARD_IP}`;

// ─── Port Scanner ───

interface PathProbeResult {
  path: string;
  status: ProbeStatus;
  httpStatus?: number;
  latencyMs?: number;
  contentSnippet?: string;
}

interface PortScanResult {
  port: number;
  protocol: string;
  status: ProbeStatus;
  latencyMs?: number;
  serverHeader?: string;
  contentSnippet?: string;
  discoveredPaths?: PathProbeResult[];
}

const PORTS_TO_SCAN = [
  { port: 80, protocol: 'HTTP' },
  { port: 443, protocol: 'HTTPS' },
  { port: 8080, protocol: 'HTTP Alt / WebSocket' },
  { port: 8443, protocol: 'HTTPS Alt' },
  { port: 3000, protocol: 'Dev Server' },
  { port: 5000, protocol: 'Flask / API' },
  { port: 8000, protocol: 'HTTP Alt' },
  { port: 8888, protocol: 'HTTP Alt' },
  { port: 9090, protocol: 'WebSocket / Admin' },
  { port: 1883, protocol: 'MQTT (TCP)' },
  { port: 9001, protocol: 'MQTT WS' },
  { port: 9002, protocol: 'MQTT WS Alt' },
];

const COMMON_PATHS = ['/', '/index.html', '/api', '/api/status', '/status', '/info', '/health', '/api/version', '/api/info', '/api/tts/speak'];

// ─── Tipos ───

type ProbeStatus = 'idle' | 'running' | 'success' | 'error' | 'timeout';

interface ProbeResult {
  status: ProbeStatus;
  latencyMs?: number;
  httpStatus?: number;
  body?: string;
  error?: string;
}

interface EndpointProbe {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  icon: typeof Cpu;
  defaultBody?: Record<string, unknown>;
  result: ProbeResult;
}

// ─── Endpoints conhecidos / suspeitos (eng. reversa V5.3.8) ───

const INITIAL_PROBES: EndpointProbe[] = [
  {
    id: 'status',
    method: 'GET',
    path: '/api/status',
    description: 'Status geral da placa Android',
    icon: Cpu,
    result: { status: 'idle' },
  },
  {
    id: 'tts-speak',
    method: 'POST',
    path: '/api/tts/speak',
    description: 'TTS — Fazer o robô falar',
    icon: Volume2,
    defaultBody: { text: 'Olá, eu sou o AlphaBot!', lang: 'pt-BR', speed: 1.0 },
    result: { status: 'idle' },
  },
  {
    id: 'tts-stop',
    method: 'POST',
    path: '/api/tts/stop',
    description: 'TTS — Parar fala atual',
    icon: Volume2,
    defaultBody: {},
    result: { status: 'idle' },
  },
  {
    id: 'enterPage',
    method: 'POST',
    path: '/api/enterPage',
    description: 'Navegar para página no app Android',
    icon: Navigation,
    defaultBody: { pageName: 'main' },
    result: { status: 'idle' },
  },
  {
    id: 'display-show',
    method: 'POST',
    path: '/api/display/show',
    description: 'Exibir conteúdo na tela do robô',
    icon: Monitor,
    defaultBody: { type: 'image', url: '', duration: 5000 },
    result: { status: 'idle' },
  },
  {
    id: 'animation-play',
    method: 'POST',
    path: '/api/animation/play',
    description: 'Executar animação/gesto',
    icon: Play,
    defaultBody: { name: 'wave', loop: false },
    result: { status: 'idle' },
  },
  {
    id: 'audio-play',
    method: 'POST',
    path: '/api/audio/play',
    description: 'Tocar som/efeito',
    icon: Volume2,
    defaultBody: { preset: 'greeting' },
    result: { status: 'idle' },
  },
  {
    id: 'audio-volume',
    method: 'POST',
    path: '/api/audio/volume',
    description: 'Ajustar volume',
    icon: Volume2,
    defaultBody: { volume: 50 },
    result: { status: 'idle' },
  },
];

// ─── Componente ───

const AndroidBoardDiag = () => {
  const { t } = useTranslation();
  const [probes, setProbes] = useState<EndpointProbe[]>(INITIAL_PROBES);
  const [runningAll, setRunningAll] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [customMethod, setCustomMethod] = useState<'GET' | 'POST'>('GET');
  const [customBody, setCustomBody] = useState('{}');
  const [customResult, setCustomResult] = useState<ProbeResult>({ status: 'idle' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Port scanner state
  const [portResults, setPortResults] = useState<PortScanResult[]>(
    PORTS_TO_SCAN.map(p => ({ port: p.port, protocol: p.protocol, status: 'idle' as ProbeStatus }))
  );
  const [scanningPorts, setScanningPorts] = useState(false);

  const probeEndpoint = useCallback(async (
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>
  ): Promise<ProbeResult> => {
    const start = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);

      const opts: RequestInit = {
        method,
        signal: ctrl.signal,
        cache: 'no-store',
      };
      if (method === 'POST' && body) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
      }

      const res = await fetch(`${BASE_URL}${path}`, opts);
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);
      const text = await res.text().catch(() => '');

      return {
        status: res.ok ? 'success' : 'error',
        latencyMs,
        httpStatus: res.status,
        body: text.slice(0, 2000),
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const message = (err as Error).message || 'Unknown error';
      return {
        status: message.includes('abort') ? 'timeout' : 'error',
        latencyMs,
        error: message,
      };
    }
  }, []);

  const runSingle = useCallback(async (id: string) => {
    const idx = probes.findIndex(p => p.id === id);
    if (idx < 0) return;
    const probe = probes[idx];

    setProbes(prev => prev.map((p, i) => i === idx ? { ...p, result: { status: 'running' } } : p));
    const result = await probeEndpoint(probe.method, probe.path, probe.defaultBody);
    setProbes(prev => prev.map((p, i) => i === idx ? { ...p, result } : p));
  }, [probes, probeEndpoint]);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    for (let i = 0; i < probes.length; i++) {
      setProbes(prev => prev.map((p, idx) => idx === i ? { ...p, result: { status: 'running' } } : p));
      const probe = probes[i];
      const result = await probeEndpoint(probe.method, probe.path, probe.defaultBody);
      setProbes(prev => prev.map((p, idx) => idx === i ? { ...p, result } : p));
    }
    setRunningAll(false);
  }, [probes, probeEndpoint]);

  const runCustom = useCallback(async () => {
    if (!customPath) return;
    setCustomResult({ status: 'running' });
    let body: Record<string, unknown> | undefined;
    if (customMethod === 'POST') {
      try { body = JSON.parse(customBody); } catch { body = {}; }
    }
    const result = await probeEndpoint(customMethod, customPath, body);
    setCustomResult(result);
  }, [customPath, customMethod, customBody, probeEndpoint]);

  // ─── Port Scanner ───

  const scanPort = useCallback(async (port: number): Promise<PortScanResult> => {
    const start = performance.now();
    const protocol = PORTS_TO_SCAN.find(p => p.port === port)?.protocol ?? 'Unknown';
    const isHttps = port === 443 || port === 8443;
    const url = `${isHttps ? 'https' : 'http'}://${BOARD_IP}:${port}/`;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', mode: 'no-cors' });
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - start);

      // In no-cors mode, opaque responses have type 'opaque' and status 0
      // but the fact that we got a response means the port is open
      const serverHeader = res.headers?.get('server') ?? undefined;
      const snippet = res.type !== 'opaque' ? await res.text().catch(() => '') : '';

      return {
        port, protocol,
        status: 'success',
        latencyMs,
        serverHeader,
        contentSnippet: snippet.slice(0, 500) || undefined,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const msg = (err as Error).message || '';
      // If we got a quick rejection, port is likely closed
      // If timeout, port might be filtered
      return {
        port, protocol,
        status: msg.includes('abort') ? 'timeout' : 'error',
        latencyMs,
      };
    }
  }, []);

  // ─── Path Discovery on open ports ───
  const discoverPaths = useCallback(async (port: number): Promise<PathProbeResult[]> => {
    const isHttps = port === 443 || port === 8443;
    const base = `${isHttps ? 'https' : 'http'}://${BOARD_IP}:${port}`;
    const results: PathProbeResult[] = [];

    for (const path of COMMON_PATHS) {
      const start = performance.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(`${base}${path}`, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - start);
        const text = await res.text().catch(() => '');
        results.push({
          path,
          status: res.ok ? 'success' : 'error',
          httpStatus: res.status,
          latencyMs,
          contentSnippet: text.slice(0, 300) || undefined,
        });
      } catch (err) {
        const latencyMs = Math.round(performance.now() - start);
        const msg = (err as Error).message || '';
        results.push({
          path,
          status: msg.includes('abort') ? 'timeout' : 'error',
          latencyMs,
        });
      }
    }
    return results;
  }, []);

  const [autoDiscovery, setAutoDiscovery] = useState(false);

  const runPortScan = useCallback(async () => {
    setScanningPorts(true);
    setPortResults(PORTS_TO_SCAN.map(p => ({ port: p.port, protocol: p.protocol, status: 'running' as ProbeStatus })));

    const promises = PORTS_TO_SCAN.map(async (p, i) => {
      const result = await scanPort(p.port);
      setPortResults(prev => prev.map((r, idx) => idx === i ? result : r));
      return result;
    });

    const results = await Promise.all(promises);

    // Auto-discover paths on open ports
    setAutoDiscovery(true);
    const openResults = results.filter(r => r.status === 'success');
    for (const open of openResults) {
      const paths = await discoverPaths(open.port);
      setPortResults(prev => prev.map(r => r.port === open.port ? { ...r, discoveredPaths: paths } : r));
    }
    setAutoDiscovery(false);
    setScanningPorts(false);
  }, [scanPort, discoverPaths]);

  const statusIcon = (s: ProbeStatus) => {
    switch (s) {
      case 'running': return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-success" />;
      case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
      case 'timeout': return <AlertTriangle className="w-5 h-5 text-warning" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const statusLabel = (r: ProbeResult) => {
    if (r.status === 'running') return 'Testando…';
    if (r.status === 'success') return `✓ HTTP ${r.httpStatus} — ${r.latencyMs}ms`;
    if (r.status === 'timeout') return `Timeout — ${r.latencyMs}ms`;
    if (r.status === 'error' && r.httpStatus) return `✗ HTTP ${r.httpStatus} — ${r.latencyMs}ms`;
    if (r.status === 'error') return `✗ ${r.error}`;
    return 'Aguardando';
  };

  const successCount = probes.filter(p => p.result.status === 'success').length;
  const errorCount = probes.filter(p => p.result.status === 'error' || p.result.status === 'timeout').length;
  const openPorts = portResults.filter(p => p.status === 'success').length;
  const scannedPorts = portResults.filter(p => p.status !== 'idle' && p.status !== 'running').length;

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      <StatusHeader title="Eng. Reversa — Placa Android" />
      <div className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">

        {/* Header info */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Cpu className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <p className="font-bold text-foreground">Placa Android — Nó Crítico</p>
                <p className="text-sm text-muted-foreground font-mono">{BASE_URL}</p>
              </div>
              {successCount > 0 && <Wifi className="w-5 h-5 text-success" />}
              {errorCount > 0 && successCount === 0 && <WifiOff className="w-5 h-5 text-destructive" />}
            </div>
          </CardContent>
        </Card>

        {/* Run all */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {successCount > 0 && <span className="text-success font-semibold">{successCount} ✓</span>}
            {errorCount > 0 && <span className="text-destructive font-semibold ml-2">{errorCount} ✗</span>}
          </div>
          <Button onClick={runAll} disabled={runningAll} className="gap-2">
            {runningAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Testar Todos
          </Button>
        </div>

        {/* Probes list */}
        <div className="space-y-2">
          {probes.map((probe, i) => {
            const expanded = expandedId === probe.id;
            return (
              <motion.div
                key={probe.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : probe.id)}
                  >
                    <probe.icon className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {probe.method}
                        </span>
                        <span className="text-sm font-mono text-foreground truncate">{probe.path}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{probe.description}</p>
                    </div>
                    {statusIcon(probe.result.status)}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); runSingle(probe.id); }}
                      disabled={probe.result.status === 'running'}
                      className="shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                    {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2">
                          <p className="text-xs text-muted-foreground">{statusLabel(probe.result)}</p>
                          {probe.defaultBody && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Request body:</p>
                              <pre className="text-xs bg-muted p-2 rounded font-mono overflow-x-auto text-foreground">
                                {JSON.stringify(probe.defaultBody, null, 2)}
                              </pre>
                            </div>
                          )}
                          {probe.result.body && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Response:</p>
                              <pre className="text-xs bg-muted p-2 rounded font-mono overflow-x-auto max-h-40 text-foreground">
                                {probe.result.body}
                              </pre>
                            </div>
                          )}
                          {probe.result.error && !probe.result.httpStatus && (
                            <p className="text-xs text-destructive">{probe.result.error}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* ─── Port Scanner ─── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Radio className="w-4 h-4" />
                Scanner de Portas + Path Discovery — {BOARD_IP}
              </CardTitle>
              <Button onClick={runPortScan} disabled={scanningPorts} size="sm" variant="outline" className="gap-2">
                {scanningPorts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {scanningPorts ? (autoDiscovery ? 'Descobrindo…' : 'Escaneando…') : 'Escanear'}
              </Button>
            </div>
            {scannedPorts > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {openPorts} porta{openPorts !== 1 ? 's' : ''} aberta{openPorts !== 1 ? 's' : ''} de {scannedPorts} testadas
                {autoDiscovery && <span className="ml-2 text-primary animate-pulse">• Descobrindo caminhos…</span>}
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-2">
              {portResults.map((pr) => (
                <motion.div
                  key={pr.port}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-sm font-mono ${
                    pr.status === 'success'
                      ? 'border-success/30 bg-success/5'
                      : pr.status === 'timeout'
                        ? 'border-warning/30 bg-warning/5'
                        : pr.status === 'error'
                          ? 'border-border bg-muted/30'
                          : 'border-border'
                  }`}
                  animate={pr.status === 'running' ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
                  transition={pr.status === 'running' ? { repeat: Infinity, duration: 1 } : {}}
                >
                  {statusIcon(pr.status)}
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-foreground">:{pr.port}</span>
                    <p className="text-xs text-muted-foreground truncate">{pr.protocol}</p>
                    {pr.latencyMs !== undefined && pr.status !== 'idle' && (
                      <p className="text-xs text-muted-foreground">{pr.latencyMs}ms</p>
                    )}
                    {pr.serverHeader && (
                      <p className="text-xs text-primary truncate">{pr.serverHeader}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Discovered paths per open port */}
            {portResults.filter(p => p.discoveredPaths && p.discoveredPaths.length > 0).map(p => (
              <div key={`paths-${p.port}`} className="mt-3 border border-border rounded-lg p-3">
                <p className="text-xs font-bold text-foreground mb-2">
                  🔍 Porta {p.port} — Caminhos Descobertos
                </p>
                <div className="space-y-1">
                  {p.discoveredPaths!.map(dp => (
                    <div key={`${p.port}-${dp.path}`} className={`flex items-center gap-2 p-1.5 rounded text-xs font-mono ${
                      dp.status === 'success' ? 'bg-success/10 border border-success/20' : 'bg-muted/30'
                    }`}>
                      {statusIcon(dp.status)}
                      <span className="text-foreground font-semibold">{dp.path}</span>
                      {dp.httpStatus && <span className="text-muted-foreground">HTTP {dp.httpStatus}</span>}
                      {dp.latencyMs !== undefined && <span className="text-muted-foreground">{dp.latencyMs}ms</span>}
                    </div>
                  ))}
                </div>
                {p.discoveredPaths!.filter(dp => dp.contentSnippet && dp.status === 'success').map(dp => (
                  <div key={`snippet-${p.port}-${dp.path}`} className="mt-2">
                    <p className="text-[10px] font-semibold text-muted-foreground">{dp.path} — resposta:</p>
                    <pre className="text-[10px] bg-muted p-2 rounded font-mono overflow-x-auto max-h-20 text-foreground">
                      {dp.contentSnippet}
                    </pre>
                  </div>
                ))}
              </div>
            ))}
            {portResults.some(p => p.contentSnippet) && (
              <div className="mt-3 space-y-2">
                {portResults.filter(p => p.contentSnippet).map(p => (
                  <div key={`snippet-${p.port}`}>
                    <p className="text-xs font-semibold text-muted-foreground">Porta {p.port} — conteúdo:</p>
                    <pre className="text-xs bg-muted p-2 rounded font-mono overflow-x-auto max-h-24 text-foreground">
                      {p.contentSnippet}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Endpoint Customizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <select
                value={customMethod}
                onChange={e => setCustomMethod(e.target.value as 'GET' | 'POST')}
                className="bg-muted text-foreground text-sm rounded px-2 py-1 border border-border"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
              <Input
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
                placeholder="/api/..."
                className="font-mono text-sm"
              />
              <Button onClick={runCustom} disabled={customResult.status === 'running' || !customPath} size="sm">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {customMethod === 'POST' && (
              <textarea
                value={customBody}
                onChange={e => setCustomBody(e.target.value)}
                rows={3}
                className="w-full bg-muted text-foreground text-xs font-mono rounded p-2 border border-border resize-y"
                placeholder='{"key": "value"}'
              />
            )}
            {customResult.status !== 'idle' && (
              <div className="flex items-center gap-2 text-sm">
                {statusIcon(customResult.status)}
                <span className="text-muted-foreground">{statusLabel(customResult)}</span>
              </div>
            )}
            {customResult.body && (
              <pre className="text-xs bg-muted p-2 rounded font-mono overflow-x-auto max-h-40 text-foreground">
                {customResult.body}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AndroidBoardDiag;
