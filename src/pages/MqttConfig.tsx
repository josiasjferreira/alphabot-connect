/**
 * MqttConfig — Página de configuração técnica MQTT.
 *
 * Baseada no relatório técnico de 20/02/2026 que identificou:
 * - BUG #002: IP hardcoded causando timeout de conexão
 * - BUG #003: IPs em múltiplos arquivos dificultam migração
 * - Bloqueador #1: Broker MQTT não encontrado na rede
 *
 * Solução:
 * - Configuração persistente de IP/porta/serial
 * - Descoberta automática varrendo todos os IPs/portas candidatos
 * - Diagnóstico de conectividade com detalhes técnicos
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Search, CheckCircle2, XCircle, Loader2,
  Radio, Settings, Wifi, AlertTriangle, Info, RefreshCw,
  Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useMQTTConfigStore, DEFAULT_BROKER_IPS, DEFAULT_WS_PORTS, generateCandidateUrls } from '@/store/useMQTTConfigStore';
import { RobotMQTTClient } from '@/services/RobotMQTTClient';
import { isPWA, isHttpsContext } from '@/services/RobotWiFiConnection';

interface ProbeResult {
  url: string;
  status: 'waiting' | 'trying' | 'ok' | 'fail';
  latencyMs?: number;
}

const MqttConfig = () => {
  const navigate = useNavigate();
  const config = useMQTTConfigStore();

  const [customIp, setCustomIp] = useState('');
  const [wsPort, setWsPort] = useState(String(config.wsPort));
  const [serial, setSerial] = useState(config.robotSerial);
  const [activeBroker, setActiveBroker] = useState(config.activeBroker);

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [probeResults, setProbeResults] = useState<ProbeResult[]>([]);
  const [foundBroker, setFoundBroker] = useState<string | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [showTechInfo, setShowTechInfo] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const cancelRef = useRef(false);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 80));
  };

  const isSecureContext = isHttpsContext() && !isPWA();

  // ─── Auto Discovery ───

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setDiscoveryProgress(0);
    setFoundBroker(null);
    setTestResult('idle');
    cancelRef.current = false;

    const ips = customIp.trim()
      ? [customIp.trim(), ...DEFAULT_BROKER_IPS]
      : DEFAULT_BROKER_IPS;

    const allUrls = generateCandidateUrls(ips);
    const results: ProbeResult[] = allUrls.map(url => ({ url, status: 'waiting' }));
    setProbeResults(results);

    addLog(`Iniciando descoberta em ${allUrls.length} endereços...`);

    let completed = 0;
    const total = allUrls.length;

    // Agrupa por porta, testa IPs em paralelo por porta
    for (const port of DEFAULT_WS_PORTS) {
      if (cancelRef.current) break;

      const portUrls = allUrls.filter(u => u.includes(`:${port}`));
      addLog(`Testando porta ${port} em ${portUrls.length} IPs...`);

      // Marca como "trying"
      setProbeResults(prev => prev.map(r =>
        portUrls.includes(r.url) ? { ...r, status: 'trying' } : r
      ));

      const probes = portUrls.map(async (url) => {
        if (cancelRef.current) return null;
        const latency = await RobotMQTTClient.probeUrl(url, 3500);
        completed++;
        setDiscoveryProgress(Math.round((completed / total) * 100));

        setProbeResults(prev => prev.map(r =>
          r.url === url
            ? { ...r, status: latency !== null ? 'ok' : 'fail', latencyMs: latency ?? undefined }
            : r
        ));

        if (latency !== null) {
          addLog(`✅ BROKER ENCONTRADO: ${url} (${latency}ms)`);
        } else {
          addLog(`❌ Falhou: ${url}`);
        }

        return latency !== null ? url : null;
      });

      const results = await Promise.all(probes);
      const found = results.find((r): r is string => r !== null);

      if (found) {
        setFoundBroker(found);
        addLog(`🎉 Conectar a: ${found}`);
        // Aguarda restantes completarem sem cancelar
        break;
      }
    }

    setDiscoveryProgress(100);
    setIsDiscovering(false);
  };

  // ─── Manual Test ───

  const handleTest = async () => {
    const brokerUrl = activeBroker.trim() || config.activeBroker;
    if (!brokerUrl) return;

    setIsTesting(true);
    setTestResult('idle');
    setTestError(null);
    setTestLatency(null);
    addLog(`Testando conexão: ${brokerUrl}`);

    const latency = await RobotMQTTClient.probeUrl(brokerUrl, 8000);

    if (latency !== null) {
      setTestResult('ok');
      setTestLatency(latency);
      addLog(`✅ Conexão OK! Latência: ${latency}ms`);
    } else {
      setTestResult('fail');
      setTestError(
        `Não foi possível conectar a ${brokerUrl}\n\n` +
        `Possíveis causas:\n` +
        `• Não está no Wi-Fi do robô (RoboKen_Controle)\n` +
        `• Broker MQTT não está ativo nessa porta\n` +
        `• Use "Descoberta Automática" para encontrar o IP/porta corretos`
      );
      addLog(`❌ Falha ao conectar: ${brokerUrl}`);
    }

    setIsTesting(false);
  };

  const handleApply = () => {
    const brokerToUse = foundBroker || activeBroker.trim();
    if (!brokerToUse) return;
    config.setActiveBroker(brokerToUse);
    config.setRobotSerial(serial || 'H13307');
    config.setWsPort(parseInt(wsPort) || 9001);
    setActiveBroker(brokerToUse);
    addLog(`✅ Configuração salva: ${brokerToUse}`);
  };

  const foundCount = probeResults.filter(r => r.status === 'ok').length;
  const testedCount = probeResults.filter(r => r.status !== 'waiting' && r.status !== 'trying').length;

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 rounded-xl hover:bg-muted active:bg-muted/80">
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">⚙️ Config MQTT</h1>
            <p className="text-xs text-muted-foreground">Configuração técnica de comunicação</p>
          </div>
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Security Warning */}
        {isSecureContext && (
          <Card className="border-destructive/60 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-destructive mb-1">Mixed Content detectado</p>
                <p className="text-xs text-muted-foreground">
                  Você está acessando via HTTPS. O broker MQTT usa ws:// (não seguro).
                  O navegador pode bloquear a conexão. <strong className="text-foreground">Instale o app como PWA</strong> para resolver.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Technical Info (from APK reverse engineering) */}
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <button
              onClick={() => setShowTechInfo(!showTechInfo)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Informações Técnicas CSJBot</span>
              </div>
              {showTechInfo ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {showTechInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-2 text-[11px] font-mono bg-muted/20 rounded-lg p-3">
                    <p className="text-muted-foreground font-sans text-xs font-semibold mb-2">📱 Extraído dos APKs (RobotSDK 2.4.0):</p>
                    <div className="space-y-1">
                      <p><span className="text-muted-foreground">IP Robô:</span> <span className="text-foreground">192.168.99.101</span> <span className="text-muted-foreground">(ConnectConstants.serverIp)</span></p>
                      <p><span className="text-muted-foreground">IP SLAM:</span> <span className="text-foreground">192.168.99.2</span></p>
                      <p><span className="text-muted-foreground">MQTT:</span> <span className="text-foreground">Eclipse Paho v3.1.1</span></p>
                      <p><span className="text-muted-foreground">Porta MQTT:</span> <span className="text-foreground">1883</span></p>
                      <p><span className="text-muted-foreground">Porta WS:</span> <span className="text-foreground">9001 (Mosquitto) ou 1883</span></p>
                      <p><span className="text-muted-foreground">HTTP:</span> <span className="text-foreground">Retrofit2 + OkHttp3 (porta 80)</span></p>
                      <p><span className="text-muted-foreground">Serial:</span> <span className="text-foreground">H13307 (CT300)</span></p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-muted-foreground font-sans text-[10px]">Tópicos MQTT confirmados:</p>
                      {['robot/{SN}/calibration/progress', 'robot/{SN}/calibration/complete', 'robot/{SN}/movement/{dir}', 'csjbot/{SN}/#', 'slamware/#'].map(t => (
                        <p key={t} className="text-primary/80">{t}</p>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Auto Discovery */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Descoberta Automática de Broker
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              Varre automaticamente todos os IPs e portas candidatos para encontrar o broker MQTT do robô.
            </p>

            {/* Custom IP input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">IP personalizado (opcional)</label>
              <input
                type="text"
                value={customIp}
                onChange={e => setCustomIp(e.target.value)}
                placeholder="ex: 192.168.2.150"
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Se souber o IP do tablet, adicione aqui para dar prioridade.</p>
            </div>

            <Button
              onClick={handleDiscover}
              disabled={isDiscovering}
              className="w-full gap-2"
            >
              {isDiscovering
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Descobrindo... ({testedCount}/{probeResults.length})</>
                : <><Search className="w-4 h-4" /> Descoberta Automática</>
              }
            </Button>

            {/* Progress */}
            {isDiscovering && (
              <div className="space-y-2">
                <Progress value={discoveryProgress} className="h-2" />
                <p className="text-[10px] text-muted-foreground text-center">{discoveryProgress}% — {testedCount} testados, {foundCount} encontrados</p>
              </div>
            )}

            {/* Found broker banner */}
            <AnimatePresence>
              {foundBroker && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="p-3 rounded-xl bg-success/10 border border-success/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-sm font-bold text-success">Broker encontrado!</span>
                  </div>
                  <code className="text-xs font-mono text-foreground block mb-3">{foundBroker}</code>
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-success hover:bg-success/90"
                    onClick={() => {
                      config.setActiveBroker(foundBroker);
                      setActiveBroker(foundBroker);
                      addLog(`✅ Broker aplicado: ${foundBroker}`);
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Usar este broker
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Probe results grid */}
            {probeResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {probeResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-mono transition-colors ${
                    r.status === 'ok' ? 'bg-success/10 border border-success/20' :
                    r.status === 'fail' ? 'bg-muted/30' :
                    r.status === 'trying' ? 'bg-primary/10 border border-primary/20' :
                    'bg-muted/10'
                  }`}>
                    {r.status === 'ok' && <CheckCircle2 className="w-3 h-3 text-success shrink-0" />}
                    {r.status === 'fail' && <XCircle className="w-3 h-3 text-muted-foreground shrink-0" />}
                    {r.status === 'trying' && <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />}
                    {r.status === 'waiting' && <div className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" />}
                    <span className={r.status === 'ok' ? 'text-foreground font-bold' : 'text-muted-foreground'}>{r.url}</span>
                    {r.latencyMs !== undefined && (
                      <span className="ml-auto text-success font-bold">{r.latencyMs}ms</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Configuration */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Configuração Manual
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">URL do Broker MQTT</label>
              <input
                type="text"
                value={activeBroker}
                onChange={e => setActiveBroker(e.target.value)}
                placeholder="ws://192.168.99.101:9001"
                className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Porta WebSocket</label>
                <select
                  value={wsPort}
                  onChange={e => {
                    setWsPort(e.target.value);
                    const ip = activeBroker.match(/ws:\/\/([^:]+)/)?.[1] || '192.168.99.101';
                    setActiveBroker(`ws://${ip}:${e.target.value}`);
                  }}
                  className="w-full h-10 px-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none font-mono"
                >
                  {DEFAULT_WS_PORTS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Serial do Robô</label>
                <input
                  type="text"
                  value={serial}
                  onChange={e => setSerial(e.target.value)}
                  placeholder="H13307"
                  className="w-full h-10 px-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono uppercase"
                />
              </div>
            </div>

            {/* Candidate IP buttons */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">IPs candidatos (toque para selecionar):</p>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_BROKER_IPS.map(ip => (
                  <button
                    key={ip}
                    onClick={() => setActiveBroker(`ws://${ip}:${wsPort}`)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                      activeBroker.includes(ip)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    {ip}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleTest} disabled={isTesting} variant="outline" className="gap-2">
                {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isTesting ? 'Testando...' : 'Testar'}
              </Button>
              <Button onClick={handleApply} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Aplicar
              </Button>
            </div>

            {/* Test result */}
            <AnimatePresence>
              {testResult !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`p-3 rounded-xl text-xs ${testResult === 'ok' ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'}`}
                >
                  {testResult === 'ok' ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-success font-bold">Conectado! Latência: {testLatency}ms</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-destructive whitespace-pre-line">{testError}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Current Config Summary */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Configuração Ativa</span>
            </div>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Broker:</span>
                <span className="text-foreground">{config.activeBroker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serial:</span>
                <span className="text-foreground">{config.robotSerial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Porta WS:</span>
                <span className="text-foreground">{config.wsPort}</span>
              </div>
            </div>
            <button
              onClick={() => { config.resetToDefaults(); setActiveBroker(config.activeBroker); setSerial(config.robotSerial); setWsPort(String(config.wsPort)); }}
              className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="w-3 h-3" /> Restaurar padrões
            </button>
          </CardContent>
        </Card>

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-foreground mb-2">📋 Log ({logs.length})</p>
              <div className="max-h-36 overflow-y-auto space-y-0.5 bg-muted/20 rounded-lg p-2">
                {logs.map((l, i) => (
                  <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{l}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-[10px] text-center text-muted-foreground pb-4">
          AlphaBot Companion v1.4.3 • Iascom
        </p>
      </div>
    </div>
  );
};

export default MqttConfig;
