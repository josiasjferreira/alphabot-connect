/**
 * useMQTTConfigStore — Configurações MQTT persistidas no localStorage.
 *
 * Topologia de rede final (Fev/2026):
 *   - Broker MQTT:     192.168.99.197 (PC/Mosquitto v2.1.2)
 *   - Robô CSJBot:     192.168.99.102
 *   - Tablet Android:  192.168.99.200
 *   - SLAM:            192.168.99.2
 *   - Gateway:         192.168.99.1 (Tenda)
 *   - Porta MQTT:      1883 (TCP, anônimo)
 *   - Serial do robô:  H13307 (CT300)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MQTTConfig {
  // Endereços candidatos (em ordem de tentativa)
  brokerCandidates: string[];
  // Configuração ativa (salva após conexão bem-sucedida)
  activeBroker: string;
  // Serial number do robô
  robotSerial: string;
  // Porta WebSocket MQTT preferida
  wsPort: number;
  // Timeout de conexão (ms)
  connectTimeout: number;
  // Auto-descoberta habilitada
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
 * Portas WebSocket MQTT comuns:
   * - 1883: MQTT padrão (Mosquitto — PRIORIDADE na rede atual)
   * - 9001: Mosquitto WebSocket alternativo
 * - 8080: EMQX WebSocket padrão
 * - 8083: EMQX WebSocket alternativo
 */
export const DEFAULT_WS_PORTS = [1883, 9001, 8080, 8083];
export const DEFAULT_WSS_PORTS = [8084, 8883]; // TLS/WSS (Mosquitto TLS, EMQX WSS)

/**
 * IPs candidatos — topologia final (Fev/2026):
 * - 192.168.99.197: PC Windows — Broker MQTT central (Mosquitto)
 * - 192.168.99.102: Robô CSJBot CT300-H13307
 * - 192.168.99.200: Tablet Android (IoT MQTT Panel)
 * - 192.168.99.1:   Gateway/Roteador Tenda
 * - 192.168.99.2:   Módulo SLAM Slamware
 */
export const DEFAULT_BROKER_IPS = [
  '192.168.99.197',
  '192.168.99.102',
  '192.168.99.200',
  '192.168.99.1',
  '192.168.99.2',
];

const DEFAULT_CONFIG: MQTTConfig = {
  brokerCandidates: DEFAULT_BROKER_IPS.map(ip => `ws://${ip}:1883`),
  activeBroker: 'ws://192.168.99.197:1883',
  robotSerial: 'H13307',
  wsPort: 1883,
  connectTimeout: 8000,
  autoDiscovery: true,
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
 * Gera lista de URLs a testar na ordem de prioridade:
 * Para cada IP candidato, testa as portas WS mais comuns.
 */
export function generateCandidateUrls(ips: string[] = DEFAULT_BROKER_IPS, includeWss = false): string[] {
  const urls: string[] = [];
  // Prioridade: ws:// porta 1883 (Mosquitto), depois 9001, etc.
  for (const port of DEFAULT_WS_PORTS) {
    for (const ip of ips) {
      urls.push(`ws://${ip}:${port}`);
    }
  }
  // Opcional: incluir wss:// para Mixed Content (requer broker com TLS)
  if (includeWss) {
    for (const port of DEFAULT_WSS_PORTS) {
      for (const ip of ips) {
        urls.push(`wss://${ip}:${port}`);
      }
    }
  }
  return urls;
}
