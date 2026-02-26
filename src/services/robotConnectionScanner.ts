/**
 * Robot Connection Scanner Service
 * Tests IP:port combinations via HTTP/WebSocket to discover robot APIs.
 * 
 * TODO: conectar portas descobertas à leitura/controle real de sensores quando API for confirmada.
 */

export interface PortScanResult {
  port: number;
  status: 'open' | 'closed' | 'unknown';
  protocol: 'http' | 'ws' | 'unknown';
  serviceType: 'sensors' | 'control' | 'other' | 'unknown';
  responsePreview: string;
  latencyMs: number;
}

export interface ScanConfig {
  ip: string;
  ports: number[];
  timeoutMs: number;
}

const SENSOR_KEYWORDS = ['sensor', 'lidar', 'imu', 'ultrasonic', 'proximity', 'temperature', 'humidity', 'gyro', 'accelerometer', 'infrared'];
const CONTROL_KEYWORDS = ['motor', 'move', 'speed', 'velocity', 'command', 'control', 'drive', 'servo', 'actuator', 'navigation', 'nav'];
const STATUS_KEYWORDS = ['status', 'battery', 'health', 'version', 'info', 'system', 'state', 'diagnostics'];

export const DEFAULT_PORTS = [80, 443, 3000, 5000, 6000, 8000, 8080, 8443, 8888, 9000, 9090, 9999, 10000];
export const DEFAULT_IP = '127.0.0.1';
export const SECONDARY_IP = '192.168.99.10'; // Placa Android

function classifyResponse(text: string): PortScanResult['serviceType'] {
  const lower = text.toLowerCase();
  const sensorScore = SENSOR_KEYWORDS.filter(k => lower.includes(k)).length;
  const controlScore = CONTROL_KEYWORDS.filter(k => lower.includes(k)).length;
  const statusScore = STATUS_KEYWORDS.filter(k => lower.includes(k)).length;

  if (sensorScore > 0 && sensorScore >= controlScore) return 'sensors';
  if (controlScore > 0) return 'control';
  if (statusScore > 0) return 'sensors';
  return 'other';
}

function truncate(str: string, max = 200): string {
  return str.length > max ? str.substring(0, max) + '…' : str;
}

export async function testPortHttp(ip: string, port: number, timeoutMs = 3000): Promise<PortScanResult> {
  const start = Date.now();
  const paths = ['/', '/status', '/sensors', '/health', '/api', '/info'];
  const protocol = port === 443 || port === 8443 ? 'https' : 'http';

  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`${protocol}://${ip}:${port}${path}`, {
        signal: controller.signal,
        mode: 'no-cors',
      });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;

      // no-cors gives opaque response — status 0 means it reached something
      if (res.type === 'opaque') {
        return {
          port,
          status: 'open',
          protocol: 'http',
          serviceType: 'unknown',
          responsePreview: `Porta aberta (opaque response em ${path})`,
          latencyMs,
        };
      }

      let body = '';
      try {
        body = await res.text();
      } catch {}

      return {
        port,
        status: 'open',
        protocol: 'http',
        serviceType: body ? classifyResponse(body) : 'unknown',
        responsePreview: truncate(body || `HTTP ${res.status} em ${path}`),
        latencyMs,
      };
    } catch {
      // Try next path
    }
  }

  return {
    port,
    status: 'closed',
    protocol: 'unknown',
    serviceType: 'unknown',
    responsePreview: '',
    latencyMs: Date.now() - start,
  };
}

export async function testPortWebSocket(ip: string, port: number, timeoutMs = 3000): Promise<PortScanResult> {
  const start = Date.now();
  const wsProtocol = port === 443 || port === 8443 ? 'wss' : 'ws';

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.close();
      resolve({
        port,
        status: 'closed',
        protocol: 'ws',
        serviceType: 'unknown',
        responsePreview: 'Timeout WebSocket',
        latencyMs: Date.now() - start,
      });
    }, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsProtocol}://${ip}:${port}`);
    } catch {
      clearTimeout(timer);
      resolve({
        port,
        status: 'closed',
        protocol: 'ws',
        serviceType: 'unknown',
        responsePreview: 'Erro ao criar WebSocket',
        latencyMs: Date.now() - start,
      });
      return;
    }

    ws.onopen = () => {
      clearTimeout(timer);
      // Send a test message
      try { ws.send(JSON.stringify({ type: 'status_request' })); } catch {}
      // Wait briefly for a response
      const respTimer = setTimeout(() => {
        ws.close();
        resolve({
          port,
          status: 'open',
          protocol: 'ws',
          serviceType: 'unknown',
          responsePreview: 'WebSocket aberto (sem resposta imediata)',
          latencyMs: Date.now() - start,
        });
      }, 1500);

      ws.onmessage = (event) => {
        clearTimeout(respTimer);
        const data = typeof event.data === 'string' ? event.data : '';
        ws.close();
        resolve({
          port,
          status: 'open',
          protocol: 'ws',
          serviceType: data ? classifyResponse(data) : 'unknown',
          responsePreview: truncate(data || 'WebSocket respondeu (dados binários)'),
          latencyMs: Date.now() - start,
        });
      };
    };

    ws.onerror = () => {
      clearTimeout(timer);
      resolve({
        port,
        status: 'closed',
        protocol: 'ws',
        serviceType: 'unknown',
        responsePreview: '',
        latencyMs: Date.now() - start,
      });
    };
  });
}

export async function scanPort(ip: string, port: number, timeoutMs = 3000): Promise<PortScanResult> {
  // Try HTTP first, then WS
  const httpResult = await testPortHttp(ip, port, timeoutMs);
  if (httpResult.status === 'open') return httpResult;

  const wsResult = await testPortWebSocket(ip, port, timeoutMs);
  if (wsResult.status === 'open') return wsResult;

  return httpResult; // Return closed
}

export async function testPortDetailed(ip: string, port: number, timeoutMs = 5000): Promise<{
  httpResponses: Array<{ path: string; status: number; body: string }>;
  wsResponse: string | null;
}> {
  const paths = ['/', '/status', '/sensors', '/health', '/api', '/info', '/api/v1/status', '/api/sensors'];
  const httpResponses: Array<{ path: string; status: number; body: string }> = [];
  const protocol = port === 443 || port === 8443 ? 'https' : 'http';

  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${protocol}://${ip}:${port}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      let body = '';
      try { body = await res.text(); } catch {}
      httpResponses.push({ path, status: res.status, body: truncate(body, 500) });
    } catch {
      // Skip unreachable paths
    }
  }

  // Try WS
  let wsResponse: string | null = null;
  try {
    const wsProto = port === 443 || port === 8443 ? 'wss' : 'ws';
    wsResponse = await new Promise<string | null>((resolve) => {
      const ws = new WebSocket(`${wsProto}://${ip}:${port}`);
      const t = setTimeout(() => { ws.close(); resolve(null); }, timeoutMs);
      ws.onopen = () => {
        try { ws.send(JSON.stringify({ type: 'status_request', timestamp: Date.now() })); } catch {}
      };
      ws.onmessage = (e) => {
        clearTimeout(t);
        ws.close();
        resolve(typeof e.data === 'string' ? truncate(e.data, 500) : '[binary data]');
      };
      ws.onerror = () => { clearTimeout(t); resolve(null); };
    });
  } catch {}

  return { httpResponses, wsResponse };
}
