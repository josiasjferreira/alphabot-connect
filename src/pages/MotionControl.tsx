/**
 * MotionControl — Controle de movimentos do robô CSJBot (RobotSDK v2.4.0)
 *
 * Publica comandos em robot/motion/cmd via MQTT.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MoveHorizontal,
  MoveVertical,
  Hand,
  Activity,
  Send,
  Clock,
  Wifi,
  WifiOff,
  Trash2,
} from 'lucide-react';
import { useMQTT } from '@/hooks/useMQTT';
import {
  type MotionAction,
  type MotionModel,
  type MotionExecutor,
  type MotionHistoryEntry,
  SDK_TOPICS,
} from '@/shared-core/types/csjbot-sdk';

const ACTIONS: { id: MotionAction; label: string; icon: typeof MoveHorizontal }[] = [
  { id: 'head_left_right', label: 'Cabeça H', icon: MoveHorizontal },
  { id: 'head_up_down', label: 'Cabeça V', icon: MoveVertical },
  { id: 'left_hand', label: 'Mão Esq', icon: Hand },
  { id: 'right_hand', label: 'Mão Dir', icon: Hand },
];

const MODELS: MotionModel[] = ['alice', 'alicebig'];
const EXECUTORS: { id: MotionExecutor; label: string }[] = [
  { id: 'processor', label: 'Padrão' },
  { id: 'vip', label: 'Alta Prioridade' },
  { id: 'resident', label: 'Residente' },
];

const MotionControl = () => {
  const navigate = useNavigate();
  const { isConnected, publish } = useMQTT();

  const [action, setAction] = useState<MotionAction>('head_left_right');
  const [model, setModel] = useState<MotionModel>('alice');
  const [executor, setExecutor] = useState<MotionExecutor>('processor');
  const [intensity, setIntensity] = useState(0.5);
  const [history, setHistory] = useState<MotionHistoryEntry[]>([]);

  const sendCommand = useCallback(() => {
    const cmd = {
      action,
      model,
      executor,
      intensity: Math.round(intensity * 100) / 100,
      timestamp: Date.now(),
    };

    publish(SDK_TOPICS.MOTION_CMD, cmd);

    const entry: MotionHistoryEntry = {
      ...cmd,
      id: `m-${Date.now()}`,
      status: isConnected ? 'sent' : 'error',
    };
    setHistory(prev => [entry, ...prev].slice(0, 30));
  }, [action, model, executor, intensity, publish, isConnected]);

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Controle de Movimentos</h1>
          <p className="text-xs text-muted-foreground">RobotSDK v2.4.0 · robot/motion/cmd</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
          {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isConnected ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Action selector */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Ação</p>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map(a => (
              <button
                key={a.id}
                onClick={() => setAction(a.id)}
                className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-colors ${
                  action === a.id
                    ? 'bg-primary text-primary-foreground shadow-button'
                    : 'bg-muted/50 text-foreground hover:bg-muted'
                }`}
              >
                <a.icon className="w-4 h-4" />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model + Executor */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Modelo</p>
            <div className="flex flex-col gap-1.5">
              {MODELS.map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    model === m
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted/50 text-foreground hover:bg-muted'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Executor</p>
            <div className="flex flex-col gap-1.5">
              {EXECUTORS.map(e => (
                <button
                  key={e.id}
                  onClick={() => setExecutor(e.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    executor === e.id
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted/50 text-foreground hover:bg-muted'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Intensity slider */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intensidade</p>
            <span className="text-sm font-bold text-primary">{Math.round(intensity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={intensity}
            onChange={e => setIntensity(parseFloat(e.target.value))}
            className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Suave</span>
            <span>Máximo</span>
          </div>
        </div>

        {/* Send button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={sendCommand}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold shadow-button"
        >
          <Send className="w-5 h-5" />
          Enviar Comando
        </motion.button>

        {/* History */}
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</p>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{history.length}</span>
            </div>
            {history.length > 0 && (
              <button onClick={() => setHistory([])} className="p-1 rounded hover:bg-muted">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-border">
            <AnimatePresence initial={false}>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum comando enviado</p>
              ) : (
                history.map(h => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-4 py-2.5 text-xs"
                  >
                    <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{h.action}</span>
                      <span className="text-muted-foreground ml-1">
                        · {h.model} · {Math.round(h.intensity * 100)}%
                      </span>
                    </div>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      h.status === 'sent' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    }`}>
                      {h.status === 'sent' ? 'Enviado' : 'Erro'}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(h.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MotionControl;
