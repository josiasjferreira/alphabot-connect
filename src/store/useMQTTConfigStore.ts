/**
 * useMQTTConfigStore — Configurações MQTT persistidas no localStorage.
 *
 * Arquitetura PC-Centric v2.0 (Fev/2026):
 *   - PC (Broker):   192.168.99.100 (Mosquitto, porta WS 9002)
 *   - Robô AlphaBot: 192.168.99.101
 *   - Tablet:        192.168.99.200 (display secundário)
 *   - Gateway:       192.168.99.102 (Router "Robo")
 *   - Porta MQTT:    1883 (TCP nativo)
 *   - Porta WS:      9002 (WebSocket — 9001 bloqueada pelo Windows)
 *   - Serial:        H13307
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MQTT_CONFIG, NETWORK_CONFIG } from '@/config/mqtt';

export interface MQTTConfig {
  brokerCandidates: string[];
  activeBroker: string;
  robotSerial: string;
  wsPort: number;
  connectTimeout: number;
  autoDiscovery: boolean;
}

interface MQTTConfigStore extends MQTTConfig {
  setActiveBroker: (url: string) => void;
  setRobotSerial: (serial: string) => void;
  setWsPort: (port: number) => void;
  setConnectTimeout: (ms: number) => void;
  setBrokerCandidates: (candidates: string[]) => void;
  setAutoDiscovery: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

/**
 * Porta 9001 BLOQUEADA pelo Windows (HTTP.SYS, PID 4).
 * Usar SEMPRE 9002 como preferencial.
 */
export const DEFAULT_WS_PORTS = [9002, 8083, 8080];
export const DEFAULT_WSS_PORTS = [8084, 8883];

/**
 * IPs candidatos — Arquitetura PC-Centric v2.0:
 * - 192.168.99.100: PC (Broker MQTT + Web Server)
 * - 192.168.99.101: Robô AlphaBot H13307
 * - 192.168.99.102: Gateway Router "Robo"
 */
export const DEFAULT_BROKER_IPS = [
  NETWORK_CONFIG.PC_IP,      // 192.168.99.100 — Broker
  NETWORK_CONFIG.ROBOT_IP,   // 192.168.99.101 — Robô
  NETWORK_CONFIG.GATEWAY_IP, // 192.168.99.102 — Gateway
];

const DEFAULT_CONFIG: MQTTConfig = {
  brokerCandidates: [MQTT_CONFIG.WEBSOCKET_URL],
  activeBroker: MQTT_CONFIG.WEBSOCKET_URL,
  robotSerial: MQTT_CONFIG.ROBOT_SERIAL,
  wsPort: MQTT_CONFIG.WEBSOCKET_PORT,
  connectTimeout: MQTT_CONFIG.CONNECT_TIMEOUT,
  autoDiscovery: false,
};

export const useMQTTConfigStore = create<MQTTConfigStore>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      setActiveBroker: (url) => set({ activeBroker: url }),
      setRobotSerial: (serial) => set({ robotSerial: serial }),
      setWsPort: (port) => set({ wsPort: port }),
      setConnectTimeout: (ms) => set({ connectTimeout: ms }),
      setBrokerCandidates: (candidates) => set({ brokerCandidates: candidates }),
      setAutoDiscovery: (enabled) => set({ autoDiscovery: enabled }),
      resetToDefaults: () => set({ ...DEFAULT_CONFIG }),
    }),
    {
      name: 'mqtt-config-storage',
    }
  )
);

/**
 * Gera lista de URLs a testar na ordem de prioridade.
 */
export function generateCandidateUrls(ips: string[] = DEFAULT_BROKER_IPS, includeWss = false): string[] {
  const urls: string[] = [];
  for (const port of DEFAULT_WS_PORTS) {
    for (const ip of ips) {
      urls.push(`ws://${ip}:${port}`);
    }
  }
  if (includeWss) {
    for (const port of DEFAULT_WSS_PORTS) {
      for (const ip of ips) {
        urls.push(`wss://${ip}:${port}`);
      }
    }
  }
  return urls;
}
