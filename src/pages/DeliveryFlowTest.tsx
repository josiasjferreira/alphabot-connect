import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Play, Square, ArrowLeft, CheckCircle2, XCircle, Loader2, Clock, Wifi, Radio, Monitor, Copy, Bluetooth, Zap, AlertTriangle, ToggleLeft, ToggleRight, MapPin, RefreshCw, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DeliveryFlowTestService, DEFAULT_FLOW_CONFIG, type DeliveryFlowStep, type DeliveryStatus, type DeliveryFlowConfig } from '@/services/deliveryFlowTestService';
import { RobotCommandBridge, ROBOT_COMMANDS, type RobotPosition } from '@/services/robotCommandBridge';
import { useBluetoothSerial } from '@/hooks/useBluetoothSerial';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRobotStore } from '@/store/useRobotStore';
import { toast } from 'sonner';

interface LogEntry {
  msg: string;
  level: 'info' | 'success' | 'warning' | 'error';
  ts: number;
}

const PHASE_LABELS: Record<string, string> = {
  'FASE 1': '🔌 Conexão Inicial',
  'FASE 2': '📋 Receber Tarefa',
  'FASE 3': '🗺️ Iniciar Navegação',
  'FASE 4': '🚗 Durante Entrega',
  'FASE 5': '🎯 Chegada na Mesa',
  'FASE 6': '🏠 Retorno à Base',
};

const STATUS_COLORS: Record<DeliveryStatus, string> = {
  IDLE: 'bg-muted text-muted-foreground',
  PREPARING: 'bg-warning/20 text-warning',
  DELIVERING: 'bg-primary/20 text-primary',
  ARRIVED: 'bg-success/20 text-success',
  RETURNING: 'bg-secondary/20 text-secondary-foreground',
  COMPLETED: 'bg-success/20 text-success',
  FAILED: 'bg-destructive/20 text-destructive',
};

const PROTOCOL_ICON: Record<string, typeof Wifi> = {
  HTTP: Wifi,
  MQTT: Radio,
  WS: Monitor,
  INTERNAL: Clock,
};

const DeliveryFlowTest = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const serviceRef = useRef<DeliveryFlowTestService | null>(null);
  const bridgeRef = useRef<RobotCommandBridge | null>(null);

  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<DeliveryFlowStep[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('IDLE');
  const [position, setPosition] = useState({ x: 0, y: 0, progress: 0 });
  const [report, setReport] = useState<string | null>(null);

  // Real mode
  const [realMode, setRealMode] = useState(false);
  const [btConnected, setBtConnected] = useState(false);

  // Real position from BT
  const [realPosition, setRealPosition] = useState<RobotPosition | null>(null);
  const [positionSource, setPositionSource] = useState<'simulated' | 'bluetooth' | 'websocket'>('simulated');

  // Channel health
  const [channelHealth, setChannelHealth] = useState<Record<string, { failures: number; healthy: boolean }>>({});

  // Config
  const [robotSN, setRobotSN] = useState(DEFAULT_FLOW_CONFIG.robotSN);
  const [robotIP, setRobotIP] = useState(DEFAULT_FLOW_CONFIG.robotIP);
  const [tableNumber, setTableNumber] = useState(DEFAULT_FLOW_CONFIG.tableNumber);

  // Real robot hooks
  const { scanAndConnect, reconnectLastDevice, sendCommand: btSendCommand, sendStop, sendEmergencyStop, disconnectBt, isSerialReady } = useBluetoothSerial();
  const { connect: wsConnect, disconnect: wsDisconnect, send: wsSend } = useWebSocket();
  const { connectionStatus, bluetoothStatus } = useRobotStore();

  const addLog = useCallback((msg: string, level: LogEntry['level']) => {
    setLogs(prev => [{ msg, level, ts: Date.now() }, ...prev].slice(0, 300));
  }, []);

  // Setup bridge with all channels + resilience
  const setupBridge = useCallback(() => {
    const bridge = new RobotCommandBridge();
    bridge.setLogger(addLog);
    bridge.setRetryConfig({ maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000 });

    // Attach Bluetooth
    if (isSerialReady) {
      bridge.attachBluetooth(async (data: string) => {
        try {
          const cmd = JSON.parse(data);
          return await btSendCommand({
            type: cmd.action === 'goto' ? 'move' : cmd.action === 'emergency_stop' ? 'emergency_stop' : 'status_request',
            angle: cmd.params?.target_theta || 0,
            speed: (cmd.params?.speed || 0.5) * 100,
            rotation: 0,
            timestamp: Date.now(),
          });
        } catch { return false; }
      });
    }

    // Attach reconnect functions
    bridge.attachBluetoothReconnect(async () => {
      const ok = await reconnectLastDevice();
      setBtConnected(ok);
      return ok;
    });

    bridge.attachWebSocketReconnect(() => wsConnect());

    // Attach WebSocket
    bridge.attachWebSocket((data: any) => {
      wsSend({ type: 'navigate', data, timestamp: Date.now() });
    });

    // Attach HTTP fallback
    bridge.attachHttp(robotIP);

    // Position callback — replace simulated with real
    bridge.onPosition((pos) => {
      setRealPosition(pos);
      setPositionSource(pos.source);
      setPosition({ x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), progress: 0 });
      addLog(`📍 Posição REAL [${pos.source.toUpperCase()}]: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) θ=${pos.theta.toFixed(0)}°`, 'success');
    });

    bridgeRef.current = bridge;
    return bridge;
  }, [addLog, isSerialReady, btSendCommand, reconnectLastDevice, wsConnect, wsSend, robotIP]);

  // Cleanup bridge on unmount
  useEffect(() => {
    return () => { bridgeRef.current?.destroy(); };
  }, []);

  // Connect real channels
  const connectRealChannels = useCallback(async () => {
    addLog('🔗 Conectando canais reais...', 'info');
    addLog('📡 Tentando Bluetooth...', 'info');
    const btOk = await scanAndConnect();
    setBtConnected(btOk);
    if (btOk) {
      addLog('✓ Bluetooth conectado', 'success');
    } else {
      addLog('⚠ Bluetooth indisponível — usando WS/HTTP como fallback', 'warning');
    }
    addLog('🌐 Conectando WebSocket...', 'info');
    wsConnect();
    return btOk;
  }, [scanAndConnect, wsConnect, addLog]);

  const runTest = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    setLogs([]);
    setReport(null);
    setDeliveryStatus('IDLE');
    setPosition({ x: 0, y: 0, progress: 0 });
    setRealPosition(null);
    setPositionSource('simulated');

    const config: Partial<DeliveryFlowConfig> = { robotSN, robotIP, tableNumber };
    const service = new DeliveryFlowTestService(config);
    serviceRef.current = service;

    const bridge = setupBridge();

    if (realMode) {
      addLog('🚀 MODO REAL — Comandos com retry e fallback BT→WS→HTTP', 'warning');
      addLog(`📡 Canais: ${bridge.getAvailableChannels().join(', ') || 'nenhum'}`, 'info');

      // Start position polling from real sensors
      bridge.startPositionPolling(1000);
    } else {
      addLog('🧪 MODO SIMULADO — Nenhum comando real será enviado', 'info');
    }

    service.setCallbacks({
      onStep: () => setSteps(service.getSteps()),
      onStatus: (status) => {
        setDeliveryStatus(status);
        if (realMode && bridge.hasAnyChannel()) {
          if (status === 'DELIVERING') bridge.sendCommand(ROBOT_COMMANDS.setLed('blue', 'solid'));
          if (status === 'ARRIVED') bridge.sendCommand(ROBOT_COMMANDS.setLed('green', 'blink'));
          if (status === 'RETURNING') bridge.sendCommand(ROBOT_COMMANDS.setLed('yellow', 'solid'));
          if (status === 'COMPLETED') bridge.sendCommand(ROBOT_COMMANDS.setLed('green', 'solid'));
          if (status === 'FAILED') bridge.sendCommand(ROBOT_COMMANDS.setLed('red', 'blink'));
        }
        // Update channel health
        setChannelHealth(bridge.getChannelHealth());
      },
      onPosition: (pos) => {
        // If we have real position from BT, prefer it
        if (realMode && realPosition && realPosition.source !== 'simulated') {
          // Real position is being updated via bridge.onPosition
          return;
        }
        setPosition(pos);
      },
      onLog: addLog,
    });

    if (realMode) {
      addLog('═══ MODO REAL: Enviando comandos com resiliência ═══', 'warning');
      await bridge.queryStatus();
    }

    await service.runCompleteFlow();

    // Stop position polling
    bridge.stopPositionPolling();

    if (realMode && bridge.hasAnyChannel()) {
      addLog('═══ Fluxo concluído. Comandos reais enviados com fallback automático. ═══', 'success');
      const health = bridge.getChannelHealth();
      addLog(`📊 Saúde dos canais — BT: ${health.bluetooth.failures} falhas | WS: ${health.websocket.failures} falhas | HTTP: ${health.http.failures} falhas`, 'info');
    }

    const r = service.generateReport();
    setReport(r);
    setRunning(false);
    setChannelHealth(bridge.getChannelHealth());

    const failed = service.getSteps().filter(s => s.status === 'FAILED').length;
    if (failed === 0) {
      toast.success(realMode ? 'Fluxo real concluído!' : 'Fluxo simulado concluído!');
    } else {
      toast.error(`Fluxo concluído com ${failed} falha(s)`);
    }
  }, [robotSN, robotIP, tableNumber, addLog, realMode, setupBridge, realPosition]);

  // Manual commands
  const sendRealGoto = useCallback(async () => {
    const bridge = bridgeRef.current || setupBridge();
    const tableCoords = DEFAULT_FLOW_CONFIG.tableCoords;
    addLog(`🎯 GOTO REAL → Mesa ${tableNumber} (${tableCoords.x}, ${tableCoords.y})`, 'warning');
    await bridge.goto(tableCoords.x, tableCoords.y);
    setChannelHealth(bridge.getChannelHealth());
  }, [addLog, tableNumber, setupBridge]);

  const sendRealStop = useCallback(async () => {
    addLog('🛑 STOP REAL enviado (todos os canais)', 'warning');
    const bridge = bridgeRef.current || setupBridge();
    await bridge.emergencyStop();
    setChannelHealth(bridge.getChannelHealth());
  }, [addLog, setupBridge]);

  const sendRealReturn = useCallback(async () => {
    const bridge = bridgeRef.current || setupBridge();
    addLog('🏠 RETORNO REAL à base', 'warning');
    await bridge.returnToBase();
    setChannelHealth(bridge.getChannelHealth());
  }, [addLog, setupBridge]);

  const queryRealPosition = useCallback(async () => {
    const bridge = bridgeRef.current || setupBridge();
    addLog('📍 Consultando posição real...', 'info');
    await bridge.queryPosition();
  }, [addLog, setupBridge]);

  const abortTest = useCallback(() => {
    serviceRef.current?.abort();
    bridgeRef.current?.stopPositionPolling();
    if (realMode) sendRealStop();
    toast.warning('Teste abortado');
  }, [realMode, sendRealStop]);

  const copyReport = useCallback(() => {
    if (report) { navigator.clipboard.writeText(report); toast.success('Relatório copiado!'); }
  }, [report]);

  const passed = steps.filter(s => s.status === 'COMPLETED').length;
  const failed = steps.filter(s => s.status === 'FAILED').length;
  const total = steps.length;
  const currentPhase = steps.length > 0 ? steps[steps.length - 1].phase : '';
  const btReady = isSerialReady || bluetoothStatus === 'connected';
  const wsReady = connectionStatus === 'connected';

  return (
    <div className="min-h-screen bg-background safe-bottom flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-card border-b border-border">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-xl hover:bg-muted active:bg-muted/80">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-foreground">
            {realMode ? '🤖 Delivery REAL' : '🧪 Teste de Delivery'}
          </h1>
          <p className="text-[10px] text-muted-foreground">
            {realMode ? 'Retry automático + Fallback BT→WS→HTTP' : 'HTTP + MQTT + WebSocket — Simulação E2E'}
          </p>
        </div>
        <Badge className={STATUS_COLORS[deliveryStatus]}>{deliveryStatus}</Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Real Mode Toggle */}
        <Card className={realMode ? 'border-warning/50 bg-warning/5' : ''}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {realMode ? (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                ) : (
                  <Zap className="w-4 h-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {realMode ? 'MODO REAL — O robô vai se mover!' : 'Modo Simulado'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {realMode ? 'Retry 3x por canal + fallback automático' : 'Sem comunicação com o robô'}
                  </p>
                </div>
              </div>
              <button onClick={() => setRealMode(!realMode)} disabled={running} className="p-1">
                {realMode ? (
                  <ToggleRight className="w-8 h-8 text-warning" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Channel status when real mode */}
            {realMode && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={btReady ? 'default' : 'secondary'} className="text-[10px]">
                    <Bluetooth className="w-3 h-3 mr-1" />
                    BT: {btReady ? 'OK' : 'Off'}
                    {channelHealth.bluetooth && !channelHealth.bluetooth.healthy && ' ⚠'}
                  </Badge>
                  <Badge variant={wsReady ? 'default' : 'secondary'} className="text-[10px]">
                    <Monitor className="w-3 h-3 mr-1" />
                    WS: {wsReady ? 'OK' : 'Off'}
                    {channelHealth.websocket && !channelHealth.websocket.healthy && ' ⚠'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Wifi className="w-3 h-3 mr-1" />
                    HTTP: Fallback
                    {channelHealth.http && !channelHealth.http.healthy && ' ⚠'}
                  </Badge>
                </div>
                {!btReady && !wsReady && (
                  <Button size="sm" variant="outline" onClick={connectRealChannels} disabled={running} className="w-full text-xs">
                    <Bluetooth className="w-3 h-3 mr-1" /> Conectar Canais
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Real Position Panel */}
        {realMode && (
          <Card className="border-primary/30">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Posição do Robô</span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {positionSource === 'bluetooth' ? '📡 BT' : positionSource === 'websocket' ? '🌐 WS' : '🧪 Sim'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-[10px] text-muted-foreground">X</p>
                  <p className="text-sm font-mono font-bold text-foreground">
                    {realPosition ? realPosition.x.toFixed(1) : position.x}
                  </p>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-[10px] text-muted-foreground">Y</p>
                  <p className="text-sm font-mono font-bold text-foreground">
                    {realPosition ? realPosition.y.toFixed(1) : position.y}
                  </p>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <p className="text-[10px] text-muted-foreground">θ</p>
                  <p className="text-sm font-mono font-bold text-foreground">
                    {realPosition ? realPosition.theta.toFixed(0) + '°' : '—'}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={queryRealPosition} disabled={running} className="w-full mt-2 text-[10px]">
                <RefreshCw className="w-3 h-3 mr-1" /> Consultar Posição
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Config */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-xs">⚙️ Configuração</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Robô SN</label>
                <Input value={robotSN} onChange={e => setRobotSN(e.target.value)} disabled={running} className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">IP</label>
                <Input value={robotIP} onChange={e => setRobotIP(e.target.value)} disabled={running} className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Mesa</label>
                <Input type="number" value={tableNumber} onChange={e => setTableNumber(+e.target.value)} disabled={running} className="text-xs h-8" />
              </div>
            </div>
            <div className="flex gap-2">
              {!running ? (
                <Button onClick={runTest} className="flex-1" size="sm" variant={realMode ? 'destructive' : 'default'}>
                  <Play className="w-4 h-4 mr-1" />
                  {realMode ? 'Executar REAL' : 'Executar Simulado'}
                </Button>
              ) : (
                <Button onClick={abortTest} variant="destructive" className="flex-1" size="sm">
                  <Square className="w-4 h-4 mr-1" /> Abortar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Real mode: direct command buttons */}
        {realMode && !running && (
          <Card className="border-warning/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs">🎮 Comandos Manuais (Real)</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" onClick={sendRealGoto} className="text-[10px]">
                  🗺️ Goto Mesa
                </Button>
                <Button size="sm" variant="destructive" onClick={sendRealStop} className="text-[10px]">
                  🛑 STOP
                </Button>
                <Button size="sm" variant="outline" onClick={sendRealReturn} className="text-[10px]">
                  🏠 Voltar Base
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        {(running || steps.length > 0) && (
          <Card>
            <CardContent className="py-3 px-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{PHASE_LABELS[currentPhase] || currentPhase}</span>
                <span className="text-[10px] text-muted-foreground">{passed}/{total} passos</span>
              </div>
              <Progress value={total > 0 ? (passed / Math.max(total, 1)) * 100 : 0} className="h-2" />
              {(deliveryStatus === 'DELIVERING' || deliveryStatus === 'RETURNING') && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Posição: ({realPosition && realMode ? `${realPosition.x.toFixed(1)}, ${realPosition.y.toFixed(1)}` : `${position.x}, ${position.y}`})
                  </span>
                  <span>{position.progress}%</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs flex items-center justify-between">
                <span>📊 Passos ({passed}✓ / {failed}✗ / {total} total)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {steps.map((step, i) => {
                  const Icon = PROTOCOL_ICON[step.protocol] || Clock;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-2 p-1.5 rounded text-[11px] ${
                        step.status === 'COMPLETED' ? 'bg-success/5' :
                        step.status === 'FAILED' ? 'bg-destructive/10' :
                        step.status === 'IN_PROGRESS' ? 'bg-primary/5' : 'bg-muted/30'
                      }`}
                    >
                      {step.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3 text-success shrink-0" /> :
                       step.status === 'FAILED' ? <XCircle className="w-3 h-3 text-destructive shrink-0" /> :
                       step.status === 'IN_PROGRESS' ? <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" /> :
                       <Clock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-foreground">{step.step}</span>
                      {step.duration != null && <span className="text-muted-foreground shrink-0">{step.duration}ms</span>}
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report */}
        {report && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs flex items-center justify-between">
                <span>📄 Relatório</span>
                <Button size="sm" variant="ghost" onClick={copyReport} className="h-6 px-2">
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <pre className="text-[10px] font-mono bg-muted/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap text-foreground">{report}</pre>
            </CardContent>
          </Card>
        )}

        {/* Log */}
        {logs.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs">📜 Log ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    log.level === 'success' ? 'text-success' :
                    log.level === 'error' ? 'text-destructive' :
                    log.level === 'warning' ? 'text-warning' :
                    'text-muted-foreground'
                  }`}>
                    {log.msg}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-1 py-3 border-t border-border">
        <button onClick={() => navigate('/dashboard')} className="text-xs text-primary font-semibold active:opacity-70">
          Voltar ao Dashboard
        </button>
        <p className="text-[10px] text-muted-foreground">AlphaBot Companion v1.2.4 • Iascom</p>
      </div>
    </div>
  );
};

export default DeliveryFlowTest;
