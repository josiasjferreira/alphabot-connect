/**
 * useMQTTConfigStore — Configurações MQTT persistidas no localStorage.
 *
 * Arquitetura PC-Centric v3.0 (Mapa Final Confirmado):
 *   .1   → Panda Router (Gateway)
 *   .2   → SLAMWARE (Navegação)
 *   .10  → Placa Android (Cérebro do robô)
 *   .100 → PC (Broker MQTT, Mosquitto, porta WS 9002)
 *   .200 → Tablet (app Lovable)
 *   Porta WS: 9002 (9001 bloqueada pelo Windows)
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
 * IPs candidatos — Arquitetura v3.0 (Mapa Final):
 * - 192.168.99.100: PC (Broker MQTT + Web Server)
 * - 192.168.99.10:  Placa Android (pode ter broker local)
 * - 192.168.99.1:   Panda Router (Gateway)
 */
export const DEFAULT_BROKER_IPS = [
  NETWORK_CONFIG.PC_IP,              // 192.168.99.100 — Broker
  NETWORK_CONFIG.ANDROID_BOARD_IP,   // 192.168.99.10  — Placa Android
  NETWORK_CONFIG.GATEWAY_IP,         // 192.168.99.1   — Gateway
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
