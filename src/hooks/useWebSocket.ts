import { useRef, useCallback, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';

export interface WebSocketMessage {
  type: 'move' | 'status' | 'emergency_stop' | 'navigate' | 'chat' | 'voice_command';
  data?: any;
  timestamp: number;
}

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

    setConnectionStatus('connecting');
    addLog(`Conectando a ws://${ip}:${port}...`);

    try {
      const ws = new WebSocket(`ws://${ip}:${port}`);

      ws.onopen = () => {
        setConnectionStatus('connected');
        addLog('Conectado ao robô!', 'success');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        addLog('Conexão perdida', 'warning');
        // Auto-reconnect after 3s
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
          const msg = JSON.parse(event.data);
          if (msg.type === 'status') {
            updateStatus(msg.data);
          }
        } catch {
          // ignore parse errors
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
      // Simulate in offline mode
      addLog(`[Offline] Comando: ${message.type}`);
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
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
