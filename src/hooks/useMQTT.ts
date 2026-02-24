/**
 * useMQTT — Hook global singleton para o RobotMQTTClient.
 *
 * Mantém UMA única instância do cliente MQTT compartilhada entre todas as páginas.
 * A configuração vem do MQTT_CONFIG centralizado + useMQTTConfigStore persistido.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RobotMQTTClient } from '@/services/RobotMQTTClient';
import { useMQTTConfigStore } from '@/store/useMQTTConfigStore';
import { MQTT_CONFIG } from '@/config/mqtt';

// ─── Singleton fora do React para sobreviver entre re-renders e navegação ───
let globalClient: RobotMQTTClient | null = null;
let globalConnected = false;
let globalMessageCount = 0;
let globalLastTopic = '';
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(fn => fn());
}

export interface UseMQTTReturn {
  client: RobotMQTTClient | null;
  isConnected: boolean;
  brokerUrl: string;
  messageCount: number;
  lastTopic: string;
  connect: (brokerUrl?: string) => Promise<void>;
  disconnect: () => void;
  publish: (topic: string, payload: string | object) => void;
}

export function useMQTT(): UseMQTTReturn {
  const config = useMQTTConfigStore();
  const [, forceUpdate] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const update = () => {
      if (mountedRef.current) forceUpdate(n => n + 1);
    };
    subscribers.add(update);
    return () => {
      mountedRef.current = false;
      subscribers.delete(update);
    };
  }, []);

  const connect = useCallback(async (brokerUrl?: string) => {
    const url = brokerUrl || config.activeBroker || MQTT_CONFIG.WEBSOCKET_URL;
    const serial = config.robotSerial || MQTT_CONFIG.ROBOT_SERIAL;

    if (globalClient?.isConnected) {
      console.log('[useMQTT] Já conectado a', globalClient.currentBroker);
      return;
    }

    if (!globalClient) {
      globalClient = new RobotMQTTClient();
    }

    await globalClient.connect(url, {
      onConnect: () => {
        globalConnected = true;
        notifySubscribers();
        // Publicar status de conexão
        globalClient?.publish(MQTT_CONFIG.TOPICS.STATUS, {
          status: 'connected',
          client: 'pc-web',
          timestamp: Date.now(),
        });
      },
      onClose: () => {
        globalConnected = false;
        notifySubscribers();
      },
      onError: (err) => {
        console.error('[useMQTT] Erro:', err.message);
        globalConnected = false;
        notifySubscribers();
      },
      onMessage: (topic, _payload) => {
        globalMessageCount++;
        globalLastTopic = topic;
        notifySubscribers();
      },
    }, serial);

    config.setActiveBroker(url);
  }, [config]);

  const disconnect = useCallback(() => {
    globalClient?.disconnect();
    globalClient = null;
    globalConnected = false;
    globalMessageCount = 0;
    globalLastTopic = '';
    notifySubscribers();
  }, []);

  const publish = useCallback((topic: string, payload: string | object) => {
    globalClient?.publish(topic, payload);
  }, []);

  return {
    client: globalClient,
    isConnected: globalConnected,
    brokerUrl: globalClient?.currentBroker ?? config.activeBroker,
    messageCount: globalMessageCount,
    lastTopic: globalLastTopic,
    connect,
    disconnect,
    publish,
  };
}
