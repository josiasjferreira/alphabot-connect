/**
 * @file RobotWiFiConnection.ts
 * @brief Detecção e gerenciamento de conexão WiFi local com robô CSJBot
 * @version 1.0.0
 */

/**
 * IPs possíveis do robô com porta EXPLÍCITA (:80)
 * CRÍTICO: o tablet responde em http://192.168.0.199:80 mas NÃO em http://192.168.0.199
 * Por isso a porta 80 deve ser sempre especificada explicitamente na URL.
 */
const ROBOT_IPS = [
  '192.168.0.1:80',      // ⭐ Roteador Tenda com port forwarding — CONFIRMADO
  '192.168.0.199:80',    // IP direto do tablet — CONFIRMADO
  '192.168.99.101:80',   // Fallback IP interno do robô
  '192.168.99.1:80',     // Fallback IP alternativo
] as const;

/**
 * Configuração da rede (port forwarding):
 * Tablet:   192.168.0.199
 * Roteador: 192.168.0.1  (Tenda)
 * Porta 80  → 192.168.0.199:80  (HTTP REST — porta padrão, CONFIRMADO)
 * Porta 1883→ 192.168.0.199:1883 (MQTT)
 * Porta 8080→ 192.168.0.199:8080 (WebSocket)
 */
export const ROBOT_NETWORK_CONFIG = {
  router: '192.168.0.1',
  tablet: '192.168.0.199',
  robotInternal: '192.168.99.101',
  ports: {
    http: 80,
    mqtt: 1883,
    ws: 8080,
  },
} as const;

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
/**
 * Ping com porta EXPLÍCITA — timeout aumentado para 10s pois tablet pode demorar
 * CRÍTICO: sempre usar http://ip:porta/path (nunca omitir :80)
 */
async function pingRobot(ip: string, timeoutMs = 10000): Promise<{ ok: boolean; latencyMs: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    console.warn(`⏰ Timeout (${timeoutMs}ms) em ${ip}`);
    ctrl.abort();
  }, timeoutMs);
  const start = performance.now();

  // CRÍTICO: URL com porta explícita (ip já inclui :80)
  const pingUrl = `http://${ip}/api/ping`;
  console.log(`🔍 Testando: ${pingUrl}`);

  try {
    const res = await fetch(pingUrl, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timer);
    const elapsed = Math.round(performance.now() - start);
    console.log(`📡 ${ip} respondeu em ${elapsed}ms | status: ${res.status}`);
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
      console.error(`❌ ${ip} — TIMEOUT (${timeoutMs}ms) — tablet dormindo ou servidor HTTP inativo`);
    } else {
      console.error(`❌ ${ip} — ${err.name}: ${err.message}`);
    }
  }

  // Fallback: endpoint raiz com porta explícita
  try {
    const rootUrl = `http://${ip}/`;
    console.log(`🔄 Fallback raiz: ${rootUrl}`);
    const res = await fetch(rootUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      console.log(`✅ ROBÔ ENCONTRADO (raiz): ${ip}`);
      return { ok: true, latencyMs: Math.round(performance.now() - start) };
    }
  } catch {
    console.log(`❌ ${ip} — fallback raiz também falhou`);
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
  console.log('📋 IPs testados com porta EXPLÍCITA :80:', [...ROBOT_IPS]);

  // Testar sequencialmente — parar no primeiro que responder
  let found: { ip: string; ok: boolean; latencyMs: number } | null = null;
  for (const ip of ROBOT_IPS) {
    const ping = await pingRobot(ip);
    if (ping.ok) {
      found = { ip, ...ping };
      console.log(`🎉 ROBÔ ENCONTRADO em ${ip} (${ping.latencyMs}ms) — parando busca`);
      break;
    }
  }

  if (!found) {
    console.error('\n❌ Robô não encontrado em nenhum IP testado');
    console.error('📋 IPs tentados:', ROBOT_IPS.join(', '));
    console.error('\n💡 Troubleshooting:');
    console.error('1. Conecte ao Wi-Fi: RoboKen_Controle ou RoboKen_Controle_5G');
    console.error('2. Verifique se o tablet está ligado e o app do robô está ativo');
    console.error('3. Teste manual no browser: http://192.168.0.199:80/api/ping');
    console.error('4. Verifique se o servidor HTTP está rodando no tablet (porta 80 EXPLÍCITA)');

    return {
      success: false,
      ip: null,
      robotInfo: null,
      error: 'Robô não encontrado.\n\nVerifique:\n1. Wi-Fi: RoboKen_Controle ou RoboKen_Controle_5G\n2. Tablet ligado com app do robô ativo\n3. Teste manual: http://192.168.0.199:80/api/ping\n\nRedes suportadas: ' + ROBOT_WIFI_NETWORKS.join(', '),
      latencyMs: -1,
    };
  }

  console.log(`✅ [WiFi] Robô detectado em ${found.ip} (${found.latencyMs}ms)`);
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
