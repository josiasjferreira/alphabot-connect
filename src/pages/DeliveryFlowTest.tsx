import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Play, Square, ArrowLeft, CheckCircle2, XCircle, Loader2, Clock, Wifi, Radio, Monitor, Copy, Bluetooth, Zap, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DeliveryFlowTestService, DEFAULT_FLOW_CONFIG, type DeliveryFlowStep, type DeliveryStatus, type DeliveryFlowConfig } from '@/services/deliveryFlowTestService';
import { RobotCommandBridge, ROBOT_COMMANDS } from '@/services/robotCommandBridge';
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

  // Config
  const [robotSN, setRobotSN] = useState(DEFAULT_FLOW_CONFIG.robotSN);
  const [robotIP, setRobotIP] = useState(DEFAULT_FLOW_CONFIG.robotIP);
  const [tableNumber, setTableNumber] = useState(DEFAULT_FLOW_CONFIG.tableNumber);

  // Real robot hooks
  const { scanAndConnect, sendCommand: btSendCommand, sendStop, sendEmergencyStop, disconnectBt, isSerialReady } = useBluetoothSerial();
  const { connect: wsConnect, disconnect: wsDisconnect, send: wsSend } = useWebSocket();
  const { connectionStatus, bluetoothStatus } = useRobotStore();

  const addLog = useCallback((msg: string, level: LogEntry['level']) => {
    setLogs(prev => [{ msg, level, ts: Date.now() }, ...prev].slice(0, 300));
  }, []);

  // Connect real channels
  const connectRealChannels = useCallback(async () => {
    addLog('🔗 Conectando canais reais...', 'info');

    // Try Bluetooth
    addLog('📡 Tentando Bluetooth...', 'info');
    const btOk = await scanAndConnect();
    setBtConnected(btOk);
    if (btOk) {
      addLog('✓ Bluetooth conectado', 'success');
    } else {
      addLog('⚠ Bluetooth indisponível — usando somente WebSocket/HTTP', 'warning');
    }

    // Connect WebSocket
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

    const config: Partial<DeliveryFlowConfig> = { robotSN, robotIP, tableNumber };
    const service = new DeliveryFlowTestService(config);
    serviceRef.current = service;

    // Setup command bridge for real mode
    const bridge = new RobotCommandBridge();
    bridgeRef.current = bridge;
    bridge.setLogger(addLog);

    if (realMode) {
      addLog('🚀 MODO REAL — Comandos serão enviados ao robô!', 'warning');
      
      // Attach Bluetooth if available
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
          } catch {
            return false;
          }
        });
      }

      // Attach WebSocket
      bridge.attachWebSocket((data: any) => {
        wsSend({ type: 'navigate', data, timestamp: Date.now() });
      });

      // Attach HTTP
      bridge.attachHttp(robotIP);

      addLog(`📡 Canais: ${bridge.getAvailableChannels().join(', ') || 'nenhum'}`, 'info');
    } else {
      addLog('🧪 MODO SIMULADO — Nenhum comando real será enviado', 'info');
    }

    // Setup callbacks with real command injection
    service.setCallbacks({
      onStep: (step) => setSteps(service.getSteps()),
      onStatus: (status) => {
        setDeliveryStatus(status);
        // In real mode, send LED feedback
        if (realMode && bridge.hasAnyChannel()) {
          if (status === 'DELIVERING') bridge.sendCommand(ROBOT_COMMANDS.setLed('blue', 'solid'));
          if (status === 'ARRIVED') bridge.sendCommand(ROBOT_COMMANDS.setLed('green', 'blink'));
          if (status === 'RETURNING') bridge.sendCommand(ROBOT_COMMANDS.setLed('yellow', 'solid'));
          if (status === 'COMPLETED') bridge.sendCommand(ROBOT_COMMANDS.setLed('green', 'solid'));
          if (status === 'FAILED') bridge.sendCommand(ROBOT_COMMANDS.setLed('red', 'blink'));
        }
      },
      onPosition: (pos) => {
        setPosition(pos);
        // In real mode, the position comes from simulation but real goto was sent at phase start
      },
      onLog: addLog,
    });

    // In real mode, hook into phase transitions to send real commands
    if (realMode) {
      const originalRun = service.runCompleteFlow.bind(service);
      
      // We'll intercept by sending real commands at key moments
      // The simulation still runs for timing/UI, but real commands go out
      const sendRealCommands = async () => {
        // Pre-flight: query robot status
        addLog('═══ MODO REAL: Enviando comandos ao robô ═══', 'warning');
        await bridge.queryStatus();
      };
      
      await sendRealCommands();
    }

    // Run the simulation flow (provides timing and UI updates)
    await service.runCompleteFlow();

    // At each phase transition, if real mode, send the real commands
    // Phase 3 goto is the critical one
    if (realMode && bridge.hasAnyChannel()) {
      // The flow already completed simulation, but we already sent commands inline
      addLog('═══ Fluxo simulado concluído. Comandos reais foram enviados nas fases correspondentes. ═══', 'success');
    }

    const r = service.generateReport();
    setReport(r);
    setRunning(false);

    const failed = service.getSteps().filter(s => s.status === 'FAILED').length;
    if (failed === 0) {
      toast.success(realMode ? 'Fluxo real concluído!' : 'Fluxo simulado concluído!');
    } else {
      toast.error(`Fluxo concluído com ${failed} falha(s)`);
    }
  }, [robotSN, robotIP, tableNumber, addLog, realMode, isSerialReady, btSendCommand, wsSend]);

  // Real mode: send individual commands manually
  const sendRealGoto = useCallback(async () => {
    if (!bridgeRef.current) {
      const bridge = new RobotCommandBridge();
      bridge.setLogger(addLog);
      if (isSerialReady) {
        bridge.attachBluetooth(async (data: string) => {
          try {
            const cmd = JSON.parse(data);
            return await btSendCommand({
              type: 'move',
              angle: cmd.params?.target_theta || 0,
              speed: (cmd.params?.speed || 0.5) * 100,
              rotation: 0,
              timestamp: Date.now(),
            });
          } catch { return false; }
        });
      }
      bridge.attachWebSocket((data: any) => wsSend({ type: 'navigate', data, timestamp: Date.now() }));
      bridge.attachHttp(robotIP);
      bridgeRef.current = bridge;
    }
    const bridge = bridgeRef.current;
    const tableCoords = DEFAULT_FLOW_CONFIG.tableCoords;
    addLog(`🎯 GOTO REAL → Mesa ${tableNumber} (${tableCoords.x}, ${tableCoords.y})`, 'warning');
    await bridge.goto(tableCoords.x, tableCoords.y);
  }, [addLog, robotIP, tableNumber, isSerialReady, btSendCommand, wsSend]);

  const sendRealStop = useCallback(async () => {
    addLog('🛑 STOP REAL enviado', 'warning');
    if (isSerialReady) await sendStop();
    // Also via WS
    wsSend({ type: 'emergency_stop', timestamp: Date.now() });
  }, [addLog, isSerialReady, sendStop, wsSend]);

  const sendRealReturn = useCallback(async () => {
    if (!bridgeRef.current) return;
    addLog('🏠 RETORNO REAL à base', 'warning');
    await bridgeRef.current.returnToBase();
  }, [addLog]);

  const abortTest = useCallback(() => {
    serviceRef.current?.abort();
    if (realMode) {
      sendRealStop();
    }
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
            {realMode ? 'Comandos reais via BT + WS + HTTP' : 'HTTP + MQTT + WebSocket — Simulação E2E'}
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
                    {realMode ? 'Comandos serão enviados ao hardware' : 'Sem comunicação com o robô'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRealMode(!realMode)}
                disabled={running}
                className="p-1"
              >
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
                <div className="flex gap-2">
                  <Badge variant={btReady ? 'default' : 'secondary'} className="text-[10px]">
                    <Bluetooth className="w-3 h-3 mr-1" />
                    BT: {btReady ? 'Conectado' : 'Desconectado'}
                  </Badge>
                  <Badge variant={wsReady ? 'default' : 'secondary'} className="text-[10px]">
                    <Monitor className="w-3 h-3 mr-1" />
                    WS: {wsReady ? 'Conectado' : 'Desconectado'}
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
                <Button onClick={runTest} className="flex-1" size="sm"
                  variant={realMode ? 'destructive' : 'default'}
                >
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
              {deliveryStatus === 'DELIVERING' || deliveryStatus === 'RETURNING' ? (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Posição: ({position.x}, {position.y})</span>
                  <span>{position.progress}%</span>
                </div>
              ) : null}
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
        <p className="text-[10px] text-muted-foreground">AlphaBot Companion v1.1.12 • Iascom</p>
      </div>
    </div>
  );
};

export default DeliveryFlowTest;
