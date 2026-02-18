import { useRef, useCallback, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { z } from 'zod';

export interface WebSocketMessage {
  type: 'move' | 'status' | 'emergency_stop' | 'navigate' | 'chat' | 'voice_command';
  data?: any;
  timestamp: number;
}

const ChatCommandSchema = z.object({
  command: z.string().max(500).trim(),
});

const MoveCommandSchema = z.object({
  angle: z.number().min(0).max(360),
  speed: z.number().min(-100).max(100),
  rotation: z.number().min(-100).max(100),
});

const OutgoingMessageSchema = z.object({
  type: z.enum(['move', 'emergency_stop', 'navigate', 'chat', 'voice_command']),
  data: z.any().optional(),
  timestamp: z.number(),
});

const sanitizeOutbound = (message: WebSocketMessage): WebSocketMessage => {
  OutgoingMessageSchema.parse(message);
  switch (message.type) {
    case 'chat':
    case 'voice_command': {
      const validated = ChatCommandSchema.parse(message.data);
      return { ...message, data: validated };
    }
    case 'move': {
      const validated = MoveCommandSchema.parse(message.data);
      return { ...message, data: validated };
    }
    case 'emergency_stop':
      return { ...message, data: undefined };
    default:
      return message;
  }
};

const StatusDataSchema = z.object({
  battery: z.number().min(0).max(100),
  temperature: z.number().min(-50).max(150),
  wifiStrength: z.number().min(0).max(5),
  speed: z.number(),
  orientation: z.number().min(0).max(360),
  posX: z.number(),
  posY: z.number(),
  motorLeft: z.number().min(-100).max(100),
  motorRight: z.number().min(-100).max(100),
  odometry: z.number(),
  powerConsumption: z.number().min(0),
}).partial();

const IncomingMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), data: StatusDataSchema }),
  z.object({ type: z.literal('chat'), data: z.any() }),
]);

const getWsProtocol = (ip: string): string => {
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || ip === 'localhost' || ip === '127.0.0.1') {
    return 'ws';
  }
  return 'wss';
};

const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const retriesRef = useRef(0);
  const manualDisconnectRef = useRef(false);
  const { setConnectionStatus, addLog, updateStatus } = useRobotStore();

  const attemptConnect = useCallback(() => {
    if (manualDisconnectRef.current) return;

    // Read current values directly from store to avoid stale closures
    const { ip, port, authToken, offlineMode } = useRobotStore.getState();

    if (offlineMode) return;

    // Close any existing connection first
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    const protocol = getWsProtocol(ip);
    setConnectionStatus('connecting');
    addLog(`Conectando a ${protocol}://${ip}:${port}... (tentativa ${retriesRef.current + 1}/${MAX_RETRIES})`);

    try {
      const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
      const ws = new WebSocket(`${protocol}://${ip}:${port}${tokenParam}`);

      ws.onopen = () => {
        retriesRef.current = 0;
        setConnectionStatus('connected');
        addLog('Conectado ao robô!', 'success');
      };

      ws.onclose = () => {
        if (manualDisconnectRef.current) return;
        setConnectionStatus('disconnected');

        if (retriesRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retriesRef.current);
          retriesRef.current += 1;
          addLog(`Conexão perdida. Reconectando em ${Math.round(delay / 1000)}s... (${retriesRef.current}/${MAX_RETRIES})`, 'warning');
          reconnectRef.current = setTimeout(() => {
            if (!useRobotStore.getState().offlineMode && !manualDisconnectRef.current) attemptConnect();
          }, delay);
        } else {
          addLog('Limite de reconexões atingido. Reconecte manualmente.', 'error');
          setConnectionStatus('error');
        }
      };

      ws.onerror = () => {
        // onclose will handle retry logic
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const result = IncomingMessageSchema.safeParse(parsed);
          if (result.success) {
            if (result.data.type === 'status') {
              updateStatus(result.data.data);
            }
          } else {
            addLog('Mensagem inválida recebida', 'warning');
          }
        } catch {
          addLog('Erro ao processar mensagem WebSocket', 'error');
        }
      };

      wsRef.current = ws;
    } catch {
      setConnectionStatus('error');
      addLog('Falha ao criar conexão WebSocket', 'error');
    }
  }, [setConnectionStatus, addLog, updateStatus]);

  const connect = useCallback(() => {
    const { offlineMode } = useRobotStore.getState();
    if (offlineMode) {
      setConnectionStatus('connected');
      addLog('Modo offline ativado', 'info');
      return;
    }
    retriesRef.current = 0;
    manualDisconnectRef.current = false;
    attemptConnect();
  }, [attemptConnect, setConnectionStatus, addLog]);

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true;
    retriesRef.current = 0;
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionStatus('disconnected');
    addLog('Desconectado');
  }, [setConnectionStatus, addLog]);

  const send = useCallback((message: WebSocketMessage) => {
    if (useRobotStore.getState().offlineMode) {
      addLog(`[Offline] Comando: ${message.type}`);
      return;
    }
    try {
      const sanitized = sanitizeOutbound(message);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(sanitized));
      }
    } catch (err) {
      addLog(`Mensagem inválida bloqueada: ${message.type}`, 'warning');
    }
  }, [addLog]);

  useEffect(() => {
    return () => {
      manualDisconnectRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, send };
};
