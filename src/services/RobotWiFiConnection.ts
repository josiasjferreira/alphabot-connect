/**
 * @file RobotWiFiConnection.ts
 * @brief Detecção e gerenciamento de conexão WiFi local com robô
 * @version 2.0.0 — Arquitetura PC-Centric
 */

import { NETWORK_CONFIG, MQTT_CONFIG } from '@/config/mqtt';

export function isHttpsContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Topologia de rede v2.0 (Fev/2026):
 * PC (Broker):  192.168.99.100
 * Robô:         192.168.99.101
 * Gateway:      192.168.99.102
 * Tablet:       192.168.99.200
 */
export const ROBOT_NETWORK_CONFIG = {
  router: NETWORK_CONFIG.GATEWAY_IP,
  broker: NETWORK_CONFIG.PC_IP,
  robot: NETWORK_CONFIG.ROBOT_IP,
  tablet: NETWORK_CONFIG.TABLET_IP,
  robotInternal: NETWORK_CONFIG.ROBOT_IP,
  ports: {
    http: 80,
    mqttTcp: 1883,
    mqttWs: MQTT_CONFIG.WEBSOCKET_PORT,
    ws: 8080,
  },
} as const;

export const ROBOT_WIFI_NETWORKS = ['Robo', 'RoboKen_Controle_5G', 'RoboKen_Controle', 'CSJBot', 'AlphaBot'] as const;

export interface RobotInfo {
  ip: string;
  model: string;
  serial: string;
  firmware: string;
  uptime: number;
  hostname: string;
}

export interface ConnectionResult {
  success: boolean;
  ip: string | null;
  robotInfo: RobotInfo | null;
  error: string | null;
  latencyMs: number;
}

const ROBOT_IPS = [
  NETWORK_CONFIG.ROBOT_IP,   // Robô AlphaBot
  NETWORK_CONFIG.PC_IP,      // PC / Broker MQTT
  NETWORK_CONFIG.GATEWAY_IP, // Gateway
] as const;

const TIMEOUT_MS = 15000;

async function pingRobot(ip: string, timeoutMs = TIMEOUT_MS): Promise<{ ok: boolean; latencyMs: number }> {
  const startGlobal = performance.now();
  const urls = [`http://${ip}/api/ping`, `http://${ip}:80/api/ping`];

  for (const pingUrl of urls) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { ctrl.abort(); }, timeoutMs);
    const start = performance.now();

    try {
      const res = await fetch(pingUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: ctrl.signal,
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
      });
      clearTimeout(timer);
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) return { ok: true, latencyMs: elapsed };
    } catch {
      clearTimeout(timer);
    }
  }

  return { ok: false, latencyMs: Math.round(performance.now() - startGlobal) };
}

async function fetchRobotInfo(ip: string, timeoutMs = 8000): Promise<RobotInfo | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://${ip}/api/status`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip,
      model: data.model ?? 'CT300-H13307',
      serial: data.serial ?? data.sn ?? 'N/A',
      firmware: data.firmware ?? data.version ?? 'N/A',
      uptime: data.uptime ?? 0,
      hostname: data.hostname ?? 'CSJBot',
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function detectRobotIP(): Promise<ConnectionResult> {
  console.log('🔍 Iniciando detecção automática de IP do robô...');

  if (isHttpsContext() && !isPWA()) {
    console.warn('⚠️ Rodando em HTTPS sem ser PWA — conexões HTTP podem ser bloqueadas');
  }

  let found: { ip: string; ok: boolean; latencyMs: number } | null = null;
  for (const ip of ROBOT_IPS) {
    const ping = await pingRobot(ip);
    if (ping.ok) {
      found = { ip, ...ping };
      break;
    }
  }

  if (!found) {
    return {
      success: false,
      ip: null,
      robotInfo: null,
      error: `Robô não encontrado.\n\nVerifique:\n1. Wi-Fi: Robo ou RoboKen_Controle\n2. Robô ligado e conectado à rede\n3. Teste: http://${NETWORK_CONFIG.ROBOT_IP}/api/ping`,
      latencyMs: -1,
    };
  }

  const robotInfo = await fetchRobotInfo(found.ip);
  return {
    success: true,
    ip: found.ip,
    robotInfo: robotInfo ?? { ip: found.ip, model: 'CT300-H13307', serial: 'N/A', firmware: 'N/A', uptime: 0, hostname: 'CSJBot' },
    error: null,
    latencyMs: found.latencyMs,
  };
}

export async function checkConnection(ip: string): Promise<boolean> {
  const { ok } = await pingRobot(ip, 3000);
  return ok;
}
