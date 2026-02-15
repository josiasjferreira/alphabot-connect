import { useRef, useCallback, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { z } from 'zod';

export interface WebSocketMessage {
  type: 'move' | 'status' | 'emergency_stop' | 'navigate' | 'chat' | 'voice_command';
  data?: any;
  timestamp: number;
}

// Outbound message validation schemas
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

/** Sanitize outbound message data based on type */
const sanitizeOutbound = (message: WebSocketMessage): WebSocketMessage => {
  // Validate overall message structure
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

// Schema for validating incoming status messages
const StatusDataSchema = z.object({
  battery: z.number().min(0).max(100),
  temperature: z.number().min(-50).max(150),
  wifiStrength: z.number().min(0).max(4),
  speed: z.number(),
  orientation: z.number().min(0).max(360),
  posX: z.number(),
  posY: z.number(),
  motorLeft: z.number().min(-100).max(100),
  motorRight: z.number().min(-100).max(100),
  odometry: z.number(),
  powerConsumption: z.number().min(0),
}).partial(); // partial to allow incremental updates

const IncomingMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), data: StatusDataSchema }),
  z.object({ type: z.literal('chat'), data: z.any() }),
]);

/** Use wss:// for non-local IPs, ws:// for local network (hardware robot) */
const getWsProtocol = (ip: string): string => {
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.') || ip === 'localhost' || ip === '127.0.0.1') {
    return 'ws';
  }
  return 'wss';
};

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const { ip, port, setConnectionStatus, addLog, updateStatus, offlineMode } = useRobotStore();

  const connect = useCallback(() => {
    if (offlineMode) {
      setConnectionStatus('connected');
      addLog('Modo offline ativado', 'info');
      return;
    }

    const protocol = getWsProtocol(ip);
    setConnectionStatus('connecting');
    addLog(`Conectando a ${protocol}://${ip}:${port}...`);

    try {
      const ws = new WebSocket(`${protocol}://${ip}:${port}`);

      ws.onopen = () => {
        setConnectionStatus('connected');
        addLog('Conectado ao robô!', 'success');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        addLog('Conexão perdida', 'warning');
        reconnectRef.current = setTimeout(() => {
          if (!offlineMode) connect();
        }, 3000);
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        addLog('Erro de conexão WebSocket', 'error');
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
  }, [ip, port, offlineMode, setConnectionStatus, addLog, updateStatus]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionStatus('disconnected');
    addLog('Desconectado');
  }, [setConnectionStatus, addLog]);

  const send = useCallback((message: WebSocketMessage) => {
    if (offlineMode) {
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
  }, [offlineMode, addLog]);

  useEffect(() => {
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { connect, disconnect, send };
};
