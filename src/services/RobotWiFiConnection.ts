/**
 * @file RobotWiFiConnection.ts
 * @brief Detecção e gerenciamento de conexão WiFi local com robô CSJBot
 * @version 1.0.0
 */

/** IPs possíveis do robô na rede local */
const ROBOT_IPS = ['192.168.99.1', '192.168.99.101', '192.168.99.2'] as const;

/** Nomes de rede WiFi do robô */
export const ROBOT_WIFI_NETWORKS = ['CSJBot', 'CSJBot-CT300', 'AlphaBot', 'Ken-AlphaBot'] as const;

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

/**
 * Tenta GET /api/ping num IP com timeout
 */
async function pingRobot(ip: string, timeoutMs = 5000): Promise<{ ok: boolean; latencyMs: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();

  try {
    const res = await fetch(`http://${ip}/api/ping`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    return { ok: res.ok, latencyMs: Math.round(performance.now() - start) };
  } catch {
    clearTimeout(timer);
    return { ok: false, latencyMs: -1 };
  }
}

/**
 * Busca informações completas do robô
 */
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

/**
 * Detecta o IP do robô testando todos os candidatos em paralelo
 */
export async function detectRobotIP(): Promise<ConnectionResult> {
  console.log('🔍 [WiFi] Detectando robô na rede local...');

  const results = await Promise.all(ROBOT_IPS.map(async (ip) => {
    const ping = await pingRobot(ip);
    return { ip, ...ping };
  }));

  const found = results.find((r) => r.ok);
  if (!found) {
    return {
      success: false,
      ip: null,
      robotInfo: null,
      error: 'Robô não encontrado na rede.\n\nVerifique:\n1. Celular/tablet conectado ao WiFi do robô\n2. Robô está ligado\n3. Redes: ' + ROBOT_WIFI_NETWORKS.join(', '),
      latencyMs: -1,
    };
  }

  console.log(`✅ [WiFi] Robô encontrado em ${found.ip} (${found.latencyMs}ms)`);
  const robotInfo = await fetchRobotInfo(found.ip);

  return {
    success: true,
    ip: found.ip,
    robotInfo: robotInfo ?? { ip: found.ip, model: 'CT300-H13307', serial: 'N/A', firmware: 'N/A', uptime: 0, hostname: 'CSJBot' },
    error: null,
    latencyMs: found.latencyMs,
  };
}

/**
 * Verifica conectividade contínua (heartbeat)
 */
export async function checkConnection(ip: string): Promise<boolean> {
  const { ok } = await pingRobot(ip, 3000);
  return ok;
}
