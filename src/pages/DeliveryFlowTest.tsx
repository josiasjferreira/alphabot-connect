import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, ArrowLeft, CheckCircle2, XCircle, Loader2, Clock, Wifi, Radio, Monitor, Copy, Bluetooth, Zap, AlertTriangle, ToggleLeft, ToggleRight, MapPin, RefreshCw, Activity, Volume2, VolumeX } from 'lucide-react';
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
import { playBackgroundTone, sendPushNotification } from '@/lib/audioEffects';
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

// ─── 2D Delivery Map Component ───────────────────────────────────────────────

interface DeliveryMap2DProps {
  robotPos: { x: number; y: number };
  tableCoords: { x: number; y: number };
  baseCoords: { x: number; y: number };
  status: DeliveryStatus;
  positionHistory: Array<{ x: number; y: number }>;
  positionSource: 'simulated' | 'bluetooth' | 'websocket';
}

const TABLES = [
  { id: 1, x: 20, y: 30 },
  { id: 3, x: 35, y: 50 },
  { id: 5, x: 50, y: 75 },
  { id: 8, x: 70, y: 40 },
];

const DeliveryMap2D = ({ robotPos, tableCoords, baseCoords, status, positionHistory, positionSource }: DeliveryMap2DProps) => {
  const MAP_W = 100;
  const MAP_H = 100;
  const SVG_W = 320;
  const SVG_H = 240;

  const toSvg = (x: number, y: number) => ({
    sx: (x / MAP_W) * SVG_W,
    sy: SVG_H - (y / MAP_H) * SVG_H,
  });

  const robot = toSvg(robotPos.x, robotPos.y);
  const table = toSvg(tableCoords.x, tableCoords.y);
  const base = toSvg(baseCoords.x, baseCoords.y);

  const pathPoints = positionHistory.map(p => {
    const s = toSvg(p.x, p.y);
    return `${s.sx},${s.sy}`;
  }).join(' ');

  const isMoving = status === 'DELIVERING' || status === 'RETURNING';

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-muted/30 border border-border">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
        {/* Grid */}
        <defs>
          <pattern id="grid" width="32" height="24" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 24" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
          </pattern>
          {/* Robot glow */}
          <radialGradient id="robotGlow">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />

        {/* All tables */}
        {TABLES.map(t => {
          const tp = toSvg(t.x, t.y);
          const isTarget = t.x === tableCoords.x && t.y === tableCoords.y;
          return (
            <g key={t.id}>
              <rect
                x={tp.sx - 8} y={tp.sy - 8} width={16} height={16} rx={3}
                fill={isTarget ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                opacity={isTarget ? 0.8 : 0.2}
                stroke={isTarget ? 'hsl(var(--primary))' : 'none'}
                strokeWidth={isTarget ? 1.5 : 0}
              />
              <text x={tp.sx} y={tp.sy + 3.5} textAnchor="middle" fontSize="8" fontWeight="bold"
                fill={isTarget ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))'}
              >
                {t.id}
              </text>
            </g>
          );
        })}

        {/* Base marker */}
        <circle cx={base.sx} cy={base.sy} r={6} fill="hsl(var(--muted-foreground))" opacity="0.3" />
        <text x={base.sx} y={base.sy - 9} textAnchor="middle" fontSize="7" fill="hsl(var(--muted-foreground))">
          BASE
        </text>
        <circle cx={base.sx} cy={base.sy} r={3} fill="hsl(var(--foreground))" opacity="0.5" />

        {/* Path trail */}
        {positionHistory.length > 1 && (
          <polyline
            points={pathPoints}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeDasharray="4,2"
            opacity="0.5"
          />
        )}

        {/* Direct line from robot to target */}
        {isMoving && (
          <line
            x1={robot.sx} y1={robot.sy}
            x2={status === 'DELIVERING' ? table.sx : base.sx}
            y2={status === 'DELIVERING' ? table.sy : base.sy}
            stroke="hsl(var(--primary))"
            strokeWidth="0.8"
            strokeDasharray="3,3"
            opacity="0.3"
          />
        )}

        {/* Robot position */}
        <circle cx={robot.sx} cy={robot.sy} r={14} fill="url(#robotGlow)" />
        {isMoving && (
          <circle cx={robot.sx} cy={robot.sy} r={10} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.3">
            <animate attributeName="r" from="6" to="14" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
        <circle cx={robot.sx} cy={robot.sy} r={5}
          fill={status === 'ARRIVED' ? 'hsl(var(--success))' : status === 'FAILED' ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
        />
        <text x={robot.sx} y={robot.sy - 9} textAnchor="middle" fontSize="7" fontWeight="600" fill="hsl(var(--foreground))">
          🤖
        </text>
      </svg>

      {/* Overlay info */}
      <div className="absolute bottom-1 left-1 flex gap-1">
        <Badge variant="outline" className="text-[8px] py-0 px-1 bg-background/80">
          {positionSource === 'bluetooth' ? '📡 BT' : positionSource === 'websocket' ? '🌐 WS' : '🧪 Sim'}
        </Badge>
        <Badge variant="outline" className="text-[8px] py-0 px-1 bg-background/80">
          ({robotPos.x.toFixed(0)}, {robotPos.y.toFixed(0)})
        </Badge>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

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

  // Position history for map trail
  const [positionHistory, setPositionHistory] = useState<Array<{ x: number; y: number }>>([]);

  // Audio toggle
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Config
  const [robotSN, setRobotSN] = useState(DEFAULT_FLOW_CONFIG.robotSN);
  const [robotIP, setRobotIP] = useState(DEFAULT_FLOW_CONFIG.robotIP);
  const [tableNumber, setTableNumber] = useState(DEFAULT_FLOW_CONFIG.tableNumber);

  // Real robot hooks
  const { scanAndConnect, reconnectLastDevice, sendCommand: btSendCommand, sendStop, sendEmergencyStop, disconnectBt, isSerialReady } = useBluetoothSerial();
  const { connect: wsConnect, disconnect: wsDisconnect, send: wsSend } = useWebSocket();
  const { connectionStatus } = useRobotStore();

  // Previous status for detecting transitions
  const prevStatusRef = useRef<DeliveryStatus>('IDLE');

  const addLog = useCallback((msg: string, level: LogEntry['level']) => {
    setLogs(prev => [{ msg, level, ts: Date.now() }, ...prev].slice(0, 300));
  }, []);

  // Audio + push notifications on status changes
  const handleStatusNotification = useCallback((newStatus: DeliveryStatus) => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = newStatus;
    if (prev === newStatus) return;

    if (newStatus === 'DELIVERING' && prev !== 'DELIVERING') {
      if (audioEnabled) playBackgroundTone('deliveryStart', 0.2);
      sendPushNotification('🚗 Entrega Iniciada', `Robô a caminho da mesa ${tableNumber}`);
      toast.info('🚗 Entrega iniciada!');
    }

    if (newStatus === 'ARRIVED') {
      if (audioEnabled) playBackgroundTone('arrival', 0.25);
      sendPushNotification('🎯 Chegou na Mesa!', `O robô chegou na mesa ${tableNumber}. Retire os itens.`);
      toast.success('🎯 Robô chegou na mesa!');
    }

    if (newStatus === 'COMPLETED') {
      if (audioEnabled) playBackgroundTone('celebrate', 0.2);
      sendPushNotification('✅ Entrega Completa', 'O robô retornou à base com sucesso.');
      toast.success('✅ Entrega completa! Robô na base.');
    }

    if (newStatus === 'RETURNING') {
      if (audioEnabled) playBackgroundTone('returnBase', 0.15);
      sendPushNotification('🏠 Retornando à Base', 'O robô está voltando para a base.');
    }

    if (newStatus === 'FAILED') {
      if (audioEnabled) playBackgroundTone('alert', 0.3);
      sendPushNotification('❌ Falha na Entrega', 'O fluxo de entrega encontrou um erro.');
      toast.error('❌ Falha na entrega!');
    }
  }, [audioEnabled, tableNumber]);

  // Setup bridge with all channels + resilience
  const setupBridge = useCallback(() => {
    const bridge = new RobotCommandBridge();
    bridge.setLogger(addLog);
    bridge.setRetryConfig({ maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000 });

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

    bridge.attachBluetoothReconnect(async () => {
      const ok = await reconnectLastDevice();
      setBtConnected(ok);
      return ok;
    });
    bridge.attachWebSocketReconnect(() => wsConnect());
    bridge.attachWebSocket((data: any) => {
      wsSend({ type: 'navigate', data, timestamp: Date.now() });
    });
    bridge.attachHttp(robotIP);

    bridge.onPosition((pos) => {
      setRealPosition(pos);
      setPositionSource(pos.source);
      setPosition({ x: +pos.x.toFixed(1), y: +pos.y.toFixed(1), progress: 0 });
      setPositionHistory(prev => [...prev, { x: pos.x, y: pos.y }].slice(-100));
    });

    bridgeRef.current = bridge;
    return bridge;
  }, [addLog, isSerialReady, btSendCommand, reconnectLastDevice, wsConnect, wsSend, robotIP]);

  useEffect(() => {
    return () => { bridgeRef.current?.destroy(); };
  }, []);

  const connectRealChannels = useCallback(async () => {
    addLog('🔗 Conectando canais reais...', 'info');
    const btOk = await scanAndConnect();
    setBtConnected(btOk);
    addLog(btOk ? '✓ Bluetooth conectado' : '⚠ Bluetooth indisponível', btOk ? 'success' : 'warning');
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
    setPositionHistory([{ x: 0, y: 0 }]);
    prevStatusRef.current = 'IDLE';

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const config: Partial<DeliveryFlowConfig> = { robotSN, robotIP, tableNumber };
    const service = new DeliveryFlowTestService(config);
    serviceRef.current = service;
    const bridge = setupBridge();

    if (realMode) {
      addLog('🚀 MODO REAL — Retry + Fallback BT→WS→HTTP', 'warning');
      addLog(`📡 Canais: ${bridge.getAvailableChannels().join(', ') || 'nenhum'}`, 'info');
      bridge.startPositionPolling(1000);
    } else {
      addLog('🧪 MODO SIMULADO', 'info');
    }

    service.setCallbacks({
      onStep: () => setSteps(service.getSteps()),
      onStatus: (status) => {
        setDeliveryStatus(status);
        handleStatusNotification(status);
        if (realMode && bridge.hasAnyChannel()) {
          if (status === 'DELIVERING') bridge.sendCommand(ROBOT_COMMANDS.setLed('blue', 'solid'));
          if (status === 'ARRIVED') bridge.sendCommand(ROBOT_COMMANDS.setLed('green', 'blink'));
          if (status === 'RETURNING') bridge.sendCommand(ROBOT_COMMANDS.setLed('yellow', 'solid'));
          if (status === 'COMPLETED') bridge.sendCommand(ROBOT_COMMANDS.setLed('green', 'solid'));
          if (status === 'FAILED') bridge.sendCommand(ROBOT_COMMANDS.setLed('red', 'blink'));
        }
        setChannelHealth(bridge.getChannelHealth());
      },
      onPosition: (pos) => {
        if (realMode && realPosition && realPosition.source !== 'simulated') return;
        setPosition(pos);
        setPositionHistory(prev => [...prev, { x: pos.x, y: pos.y }].slice(-100));
      },
      onLog: addLog,
    });

    if (realMode) {
      await bridge.queryStatus();
    }

    await service.runCompleteFlow();
    bridge.stopPositionPolling();

    if (realMode && bridge.hasAnyChannel()) {
      const health = bridge.getChannelHealth();
      addLog(`📊 Canais — BT: ${health.bluetooth.failures} falhas | WS: ${health.websocket.failures} falhas | HTTP: ${health.http.failures} falhas`, 'info');
    }

    setReport(service.generateReport());
    setRunning(false);
    setChannelHealth(bridge.getChannelHealth());

    const failedCount = service.getSteps().filter(s => s.status === 'FAILED').length;
    if (failedCount === 0) {
      toast.success(realMode ? 'Fluxo real concluído!' : 'Fluxo simulado concluído!');
    } else {
      toast.error(`Fluxo concluído com ${failedCount} falha(s)`);
    }
  }, [robotSN, robotIP, tableNumber, addLog, realMode, setupBridge, handleStatusNotification, realPosition]);

  const sendRealGoto = useCallback(async () => {
    const bridge = bridgeRef.current || setupBridge();
    addLog(`🎯 GOTO → Mesa ${tableNumber}`, 'warning');
    await bridge.goto(DEFAULT_FLOW_CONFIG.tableCoords.x, DEFAULT_FLOW_CONFIG.tableCoords.y);
    setChannelHealth(bridge.getChannelHealth());
  }, [addLog, tableNumber, setupBridge]);

  const sendRealStop = useCallback(async () => {
    addLog('🛑 STOP enviado', 'warning');
    const bridge = bridgeRef.current || setupBridge();
    await bridge.emergencyStop();
    setChannelHealth(bridge.getChannelHealth());
  }, [addLog, setupBridge]);

  const sendRealReturn = useCallback(async () => {
    const bridge = bridgeRef.current || setupBridge();
    addLog('🏠 RETORNO à base', 'warning');
    await bridge.returnToBase();
    setChannelHealth(bridge.getChannelHealth());
  }, [addLog, setupBridge]);

  const queryRealPosition = useCallback(async () => {
    const bridge = bridgeRef.current || setupBridge();
    await bridge.queryPosition();
  }, [setupBridge]);

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
  const btReady = isSerialReady;
  const wsReady = connectionStatus === 'connected';

  const currentRobotPos = useMemo(() => {
    if (realMode && realPosition) return { x: realPosition.x, y: realPosition.y };
    return { x: position.x, y: position.y };
  }, [realMode, realPosition, position]);

  const currentTableCoords = useMemo(() => {
    const t = TABLES.find(t => t.id === tableNumber);
    return t ? { x: t.x, y: t.y } : { x: DEFAULT_FLOW_CONFIG.tableCoords.x, y: DEFAULT_FLOW_CONFIG.tableCoords.y };
  }, [tableNumber]);

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
            {realMode ? 'Retry + Fallback BT→WS→HTTP' : 'Simulação E2E'}
          </p>
        </div>
        <button onClick={() => setAudioEnabled(!audioEnabled)} className="p-1.5 rounded-lg hover:bg-muted">
          {audioEnabled ? <Volume2 className="w-4 h-4 text-foreground" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
        </button>
        <Badge className={STATUS_COLORS[deliveryStatus]}>{deliveryStatus}</Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 2D Map — always visible during flow */}
        {(running || steps.length > 0) && (
          <Card>
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-xs flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Mapa de Entrega
                </span>
                <Badge variant="outline" className="text-[8px]">
                  {positionSource === 'bluetooth' ? '📡 BT Real' : positionSource === 'websocket' ? '🌐 WS Real' : '🧪 Simulado'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <DeliveryMap2D
                robotPos={currentRobotPos}
                tableCoords={currentTableCoords}
                baseCoords={{ x: 0, y: 0 }}
                status={deliveryStatus}
                positionHistory={positionHistory}
                positionSource={positionSource}
              />
            </CardContent>
          </Card>
        )}

        {/* Real Mode Toggle */}
        <Card className={realMode ? 'border-warning/50 bg-warning/5' : ''}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {realMode ? <AlertTriangle className="w-4 h-4 text-warning" /> : <Zap className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {realMode ? 'MODO REAL — O robô vai se mover!' : 'Modo Simulado'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {realMode ? 'Retry 3x + fallback automático' : 'Sem comunicação com o robô'}
                  </p>
                </div>
              </div>
              <button onClick={() => setRealMode(!realMode)} disabled={running} className="p-1">
                {realMode ? <ToggleRight className="w-8 h-8 text-warning" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
              </button>
            </div>

            {realMode && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={btReady ? 'default' : 'secondary'} className="text-[10px]">
                    <Bluetooth className="w-3 h-3 mr-1" />BT: {btReady ? 'OK' : 'Off'}
                    {channelHealth.bluetooth && !channelHealth.bluetooth.healthy && ' ⚠'}
                  </Badge>
                  <Badge variant={wsReady ? 'default' : 'secondary'} className="text-[10px]">
                    <Monitor className="w-3 h-3 mr-1" />WS: {wsReady ? 'OK' : 'Off'}
                    {channelHealth.websocket && !channelHealth.websocket.healthy && ' ⚠'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <Wifi className="w-3 h-3 mr-1" />HTTP
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

        {/* Real mode: direct commands */}
        {realMode && !running && (
          <Card className="border-warning/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs">🎮 Comandos Manuais</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-4 gap-2">
                <Button size="sm" variant="outline" onClick={sendRealGoto} className="text-[10px]">🗺️ Goto</Button>
                <Button size="sm" variant="destructive" onClick={sendRealStop} className="text-[10px]">🛑 STOP</Button>
                <Button size="sm" variant="outline" onClick={sendRealReturn} className="text-[10px]">🏠 Base</Button>
                <Button size="sm" variant="ghost" onClick={queryRealPosition} className="text-[10px]">📍 Pos</Button>
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
                <span className="text-[10px] text-muted-foreground">{passed}/{total}</span>
              </div>
              <Progress value={total > 0 ? (passed / Math.max(total, 1)) * 100 : 0} className="h-2" />
              {(deliveryStatus === 'DELIVERING' || deliveryStatus === 'RETURNING') && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    ({currentRobotPos.x.toFixed(1)}, {currentRobotPos.y.toFixed(1)})
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
              <CardTitle className="text-xs">📊 Passos ({passed}✓ / {failed}✗ / {total})</CardTitle>
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
        <p className="text-[10px] text-muted-foreground">AlphaBot Companion v2.1.1 • Iascom</p>
      </div>
    </div>
  );
};

export default DeliveryFlowTest;
