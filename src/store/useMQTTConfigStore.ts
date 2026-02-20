/**
 * useMQTTConfigStore — Configurações MQTT persistidas no localStorage.
 *
 * Baseado na engenharia reversa dos APKs CSJBot:
 *   - IP robô interno: 192.168.99.101
 *   - IP SLAM:         192.168.99.2
 *   - Broker MQTT:     porta 1883 (Eclipse Paho)
 *   - WebSocket MQTT:  porta 9001 ou 1883 (depende do broker)
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
 * - 1883: MQTT padrão (Mosquitto com listener ws ativado)
 * - 9001: Mosquitto WebSocket padrão
 * - 8080: EMQX WebSocket padrão
 * - 8083: EMQX WebSocket alternativo
 */
export const DEFAULT_WS_PORTS = [9001, 1883, 8080, 8083];

/**
 * IPs candidatos baseados na análise dos APKs:
 * - 192.168.99.101: IP interno do robô CSJBot (ConnectConstants.serverIp)
 * - 192.168.0.1:    IP do roteador da rede RoboKen_Controle
 * - 192.168.0.199:  IP do tablet do robô
 * - 192.168.99.2:   IP do SLAM/Slamware
 * - 192.168.2.5:    Roteador Tenda detectado nos testes
 */
export const DEFAULT_BROKER_IPS = [
  '192.168.99.101',
  '192.168.0.1',
  '192.168.0.199',
  '192.168.99.2',
  '192.168.2.5',
];

const DEFAULT_CONFIG: MQTTConfig = {
  brokerCandidates: DEFAULT_BROKER_IPS.map(ip => `ws://${ip}:9001`),
  activeBroker: 'ws://192.168.99.101:9001',
  robotSerial: 'H13307',
  wsPort: 9001,
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
export function generateCandidateUrls(ips: string[] = DEFAULT_BROKER_IPS): string[] {
  const urls: string[] = [];
  // Prioridade: porta 9001 para todos, depois 1883, etc.
  for (const port of DEFAULT_WS_PORTS) {
    for (const ip of ips) {
      urls.push(`ws://${ip}:${port}`);
    }
  }
  return urls;
}
