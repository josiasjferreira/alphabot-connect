/**
 * @file RobotWiFiConnection.ts
 * @brief Detecção e gerenciamento de conexão WiFi local com robô CSJBot
 * @version 1.4.0
 */

/**
 * Detecta se o app está rodando em contexto HTTPS (página servida via https://).
 * Navegadores bloqueiam requisições HTTP de páginas HTTPS (Mixed Content).
 */
export function isHttpsContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

/**
 * Detecta se o app está instalado como PWA (standalone).
 * PWAs instalados contornam a restrição de Mixed Content e conseguem acessar HTTP local.
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Topologia de rede final (Fev/2026):
 * Gateway:  192.168.99.1   (Tenda)
 * Broker:   192.168.99.197 (PC/Mosquitto)
 * Robô:     192.168.99.102
 * Tablet:   192.168.99.200
 * SLAM:     192.168.99.2
 */
export const ROBOT_NETWORK_CONFIG = {
  router: '192.168.99.1',
  broker: '192.168.99.197',
  robot: '192.168.99.102',
  tablet: '192.168.99.200',
  robotInternal: '192.168.99.102',
  ports: {
    http: 80,
    mqttTcp: 1883,   // MQTT TCP nativo — NÃO funciona em navegadores
    mqttWs: 9001,    // MQTT WebSocket — necessário para navegadores (Mosquitto listener ws)
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
 * IPs testados — topologia final (Fev/2026):
 * Prioridade: robô direto → broker PC → gateway
 */
const ROBOT_IPS = [
  '192.168.99.102',   // Robô CSJBot CT300-H13307
  '192.168.99.197',   // PC / Broker MQTT
  '192.168.99.1',     // Gateway Tenda
] as const;

const TIMEOUT_MS = 15000; // 15 segundos — tablet pode demorar para responder


/**
 * Ping com CORS explícito, cache desabilitado e timeout de 15s.
 * Testa também a variante com :80 explícito se a implícita falhar.
 */
async function pingRobot(ip: string, timeoutMs = TIMEOUT_MS): Promise<{ ok: boolean; latencyMs: number }> {
  const startGlobal = performance.now();

  // Tentar primeiro sem porta (navegador usa 80 por padrão) e depois com :80 explícito
  const urls = [`http://${ip}/api/ping`, `http://${ip}:80/api/ping`];

  for (const pingUrl of urls) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      console.warn(`⏰ Timeout (${timeoutMs}ms) em ${pingUrl}`);
      ctrl.abort();
    }, timeoutMs);
    const start = performance.now();

    console.log(`🔍 Testando: ${pingUrl}`);

    try {
      const res = await fetch(pingUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: ctrl.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      clearTimeout(timer);
      const elapsed = Math.round(performance.now() - start);
      console.log(`📡 ${pingUrl} → ${res.status} (${elapsed}ms)`);

      if (res.ok) {
        try {
          const data = await res.json();
          console.log(`✅ ROBÔ ENCONTRADO: ${pingUrl}`, data);
        } catch {
          console.log(`✅ ROBÔ ENCONTRADO: ${pingUrl} (resposta não-JSON)`);
        }
        return { ok: true, latencyMs: elapsed };
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        console.error(`❌ ${pingUrl} — TIMEOUT (${timeoutMs}ms)`);
      } else {
        console.error(`❌ ${pingUrl} — ${err.name}: ${err.message}`);
      }
    }
  }

  return { ok: false, latencyMs: Math.round(performance.now() - startGlobal) };
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

  // Aviso crítico se estiver em HTTPS sem ser PWA
  if (isHttpsContext() && !isPWA()) {
    console.warn('⚠️ ==========================================');
    console.warn('⚠️ AVISO: Rodando em HTTPS sem ser PWA!');
    console.warn('⚠️ Navegadores BLOQUEIAM requisições HTTP de páginas HTTPS.');
    console.warn('⚠️ SOLUÇÃO: Instale o app como PWA (Menu → Adicionar à tela inicial)');
    console.warn('⚠️ ==========================================');
  }

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
    console.error('3. Teste manual no browser: http://192.168.99.102:80/api/ping');
    console.error('4. Verifique se o servidor HTTP está rodando no robô (porta 80)');

    return {
      success: false,
      ip: null,
      robotInfo: null,
      error: 'Robô não encontrado.\n\nVerifique:\n1. Wi-Fi: RoboKen_Controle ou RoboKen_Controle_5G\n2. Robô ligado e conectado à rede\n3. Teste manual: http://192.168.99.102:80/api/ping\n\nRedes suportadas: ' + ROBOT_WIFI_NETWORKS.join(', '),
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
