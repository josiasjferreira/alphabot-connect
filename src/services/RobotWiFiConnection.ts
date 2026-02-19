/**
 * @file RobotWiFiConnection.ts
 * @brief Detecção e gerenciamento de conexão WiFi local com robô CSJBot
 * @version 1.0.0
 */

/** IPs possíveis do robô (conforme testes reais e engenharia reversa) */
const ROBOT_IPS = [
  '192.168.0.1',     // ⭐ IP PADRÃO (Realtek - após reset) - PRIORIDADE 1
  '192.168.99.1',    // IP customizado (firmware antigo/custom)
  '192.168.99.101',  // IP alternativo (documentação)
  '192.168.1.1',     // Outro padrão comum
  '192.168.99.2',    // Slamware (sistema de navegação)
] as const;

/** Nomes de rede WiFi do robô */
export const ROBOT_WIFI_NETWORKS = ['RoboKen_Controle_5G', 'RoboKen_Controle', 'CSJBot', 'CSJBot-CT300', 'AlphaBot', 'Ken-AlphaBot'] as const;

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
async function pingRobot(ip: string, timeoutMs = 3000): Promise<{ ok: boolean; latencyMs: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();

  // Tentar /api/ping
  try {
    console.log(`🔍 Testando: http://${ip}/api/ping`);
    const res = await fetch(`http://${ip}/api/ping`, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timer);
    const elapsed = Math.round(performance.now() - start);
    console.log(`📡 ${ip} respondeu em ${elapsed}ms com status: ${res.status}`);
    if (res.ok) {
      try {
        const data = await res.json();
        console.log(`✅ ROBÔ ENCONTRADO: ${ip}`, data);
      } catch { console.log(`✅ ROBÔ ENCONTRADO: ${ip} (resposta não-JSON)`); }
      return { ok: true, latencyMs: elapsed };
    }
    return { ok: false, latencyMs: elapsed };
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      console.log(`⏱️ ${ip} - Timeout (${timeoutMs}ms)`);
    } else {
      console.log(`❌ ${ip} - ${err.name}: ${err.message}`);
    }
  }

  // Fallback: endpoint raiz
  try {
    const res = await fetch(`http://${ip}/`, { method: 'GET', signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      console.log(`✅ ROBÔ ENCONTRADO (endpoint raiz): ${ip}`);
      return { ok: true, latencyMs: Math.round(performance.now() - start) };
    }
  } catch {
    console.log(`❌ ${ip} - endpoint raiz também falhou`);
  }

  return { ok: false, latencyMs: -1 };
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
  console.log('🔍 Iniciando detecção automática de IP do robô...');
  console.log('📋 IPs que serão testados (em ordem):', [...ROBOT_IPS]);

  const results = await Promise.all(ROBOT_IPS.map(async (ip) => {
    const ping = await pingRobot(ip);
    return { ip, ...ping };
  }));

  const found = results.find((r) => r.ok);
  if (!found) {
    console.log('\n❌ Robô não encontrado em nenhum IP');
    console.log('📋 IPs testados:', ROBOT_IPS.join(', '));
    console.log('\n💡 Dicas de troubleshooting:');
    console.log('1. Confirme que está conectado na rede: RoboKen_Controle ou RoboKen_Controle_5G');
    console.log('2. Verifique se o robô está ligado');
    console.log('3. Tente reconectar no WiFi do robô');

    return {
      success: false,
      ip: null,
      robotInfo: null,
      error: 'Robô não encontrado na rede.\n\nVerifique:\n1. Celular/tablet conectado ao WiFi do robô\n   (RoboKen_Controle_5G ou RoboKen_Controle)\n2. Robô está ligado\n3. Redes suportadas: ' + ROBOT_WIFI_NETWORKS.join(', '),
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
