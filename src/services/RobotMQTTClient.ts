/**
 * RobotMQTTClient — Connects to the CSJBot via MQTT over WebSocket.
 *
 * Arquitetura PC-Centric v2.0 (Fev/2026):
 *   Gateway:         192.168.99.1   (Panda Router)
 *   SLAMWARE:        192.168.99.2   (Navegação / mapeamento)
 *   Placa Android:   192.168.99.10  (Cérebro do robô, multimídia)
 *   Broker MQTT:     192.168.99.100 (PC/Mosquitto, porta WS 9002)
 *   Tablet:          192.168.99.200 (app Lovable)
 *
 * IMPORTANTE: Porta 9001 BLOQUEADA pelo Windows.
 * Usar SEMPRE porta 9002 para WebSocket MQTT.
 */

import mqtt, { type MqttClient } from 'mqtt';
import { MQTT_CONFIG, NETWORK_CONFIG } from '@/config/mqtt';

export interface MQTTCallbacks {
  onConnect?: () => void;
  onMessage?: (topic: string, payload: string | object) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onReconnect?: () => void;
}

export interface MQTTMessage {
  topic: string;
  payload: string | object;
  ts: string;
}

export interface DiscoveryResult {
  url: string;
  latencyMs: number;
}

// Tópicos confirmados
const ROBOT_TOPICS = [
  'robot/#',
  'csjbot/#',
  'alphabot/#',
  'slamware/#',
  'sensor/#',
  'status/#',
];

// IPs candidatos — Arquitetura PC-Centric v3.0 (Mapa Final)
const CANDIDATE_IPS = [
  NETWORK_CONFIG.PC_IP,              // 192.168.99.100 — Broker MQTT central
  NETWORK_CONFIG.ANDROID_BOARD_IP,   // 192.168.99.10  — Placa Android (pode ter broker local)
  NETWORK_CONFIG.GATEWAY_IP,         // 192.168.99.1   — Panda Router
];

// Portas WebSocket MQTT — 9002 preferencial (9001 bloqueada pelo Windows)
const CANDIDATE_WS_PORTS = [9002, 8083, 8080];

export const ROBOT_SERIAL: string = MQTT_CONFIG.ROBOT_SERIAL;

export class RobotMQTTClient {
  private client: MqttClient | null = null;
  private callbacks: MQTTCallbacks = {};
  private brokerUrl = '';

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  get currentBroker(): string {
    return this.brokerUrl;
  }

  // ─── Auto Discovery ───

  static async probeUrl(url: string, timeoutMs = 3000): Promise<number | null> {
    return new Promise((resolve) => {
      const start = performance.now();
      let settled = false;

      const settle = (result: number | null) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      try {
        const c = mqtt.connect(url, {
          clientId: `alphabot-probe-${Date.now()}`,
          clean: true,
          connectTimeout: timeoutMs,
          reconnectPeriod: 0,
          keepalive: 5,
        });

        const timer = setTimeout(() => {
          c.end(true);
          settle(null);
        }, timeoutMs + 500);

        c.on('connect', () => {
          clearTimeout(timer);
          const latency = Math.round(performance.now() - start);
          c.end(true);
          settle(latency);
        });

        c.on('error', () => {
          clearTimeout(timer);
          c.end(true);
          settle(null);
        });

      } catch {
        settle(null);
      }
    });
  }

  static async discoverBroker(
    ips: string[] = CANDIDATE_IPS,
    ports: number[] = CANDIDATE_WS_PORTS,
    onProgress?: (url: string, result: 'trying' | 'found' | 'fail') => void
  ): Promise<DiscoveryResult | null> {
    console.log('🔍 ==========================================');
    console.log('🔍 DESCOBERTA AUTOMÁTICA DE BROKER MQTT');
    console.log('🔍 IPs candidatos:', ips);
    console.log('🔍 Portas candidatas:', ports);
    console.log('🔍 ==========================================');

    for (const port of ports) {
      const candidates = ips.map(ip => `ws://${ip}:${port}`);
      const probes = candidates.map(async (url) => {
        onProgress?.(url, 'trying');
        console.log(`  🔌 Testando: ${url}`);
        const latency = await RobotMQTTClient.probeUrl(url, 3500);
        if (latency !== null) {
          console.log(`  ✅ ENCONTRADO: ${url} (${latency}ms)`);
          onProgress?.(url, 'found');
          return { url, latencyMs: latency };
        }
        console.log(`  ❌ Falhou: ${url}`);
        onProgress?.(url, 'fail');
        return null;
      });

      const results = await Promise.all(probes);
      const found = results.find((r): r is DiscoveryResult => r !== null);
      if (found) return found;
    }

    return null;
  }

  // ─── Connection ───

  async connect(
    brokerUrl: string,
    callbacks: MQTTCallbacks = {},
    robotSerial = ROBOT_SERIAL,
  ): Promise<void> {
    this.callbacks = callbacks;
    this.brokerUrl = brokerUrl;

    console.log('🔌 ==========================================');
    console.log('🔌 MQTT — CONECTANDO');
    console.log(`🔌 Broker: ${brokerUrl}`);
    console.log(`🔌 Serial: ${robotSerial}`);
    console.log('🔌 ==========================================');

    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(brokerUrl, {
          clientId: `alphabot-pc-${Date.now()}`,
          clean: true,
          connectTimeout: MQTT_CONFIG.CONNECT_TIMEOUT,
          reconnectPeriod: MQTT_CONFIG.RECONNECT_INTERVAL,
          keepalive: MQTT_CONFIG.KEEPALIVE,
          protocol: 'ws',
        });

        const connectTimer = setTimeout(() => {
          this.client?.end(true);
          reject(new Error(
            `Timeout: broker MQTT não respondeu em ${MQTT_CONFIG.CONNECT_TIMEOUT / 1000}s\n` +
            `URL testada: ${brokerUrl}\n\n` +
            `⚠️ Porta 9001 está BLOQUEADA pelo Windows (HTTP.SYS)\n` +
            `   Porta 9002 = WebSocket (necessária para navegadores)\n\n` +
            `Dicas:\n` +
            `• Configure Mosquitto com: listener 9002 / protocol websockets\n` +
            `• Verifique se está no Wi-Fi "Robo" ou "RoboKen_Controle"\n` +
            `• Tente usar a página "Config MQTT" para descoberta automática`
          ));
        }, MQTT_CONFIG.CONNECT_TIMEOUT + 1000);

        this.client.on('connect', () => {
          clearTimeout(connectTimer);
          console.log('✅ MQTT CONECTADO!');

          const topics = [
            ...ROBOT_TOPICS,
            `robot/${robotSerial}/#`,
            `csjbot/${robotSerial}/#`,
            `alphabot/${robotSerial}/#`,
          ];

          topics.forEach(topic => {
            this.client?.subscribe(topic, { qos: 0 }, (err) => {
              if (!err) console.log(`  📌 Inscrito: ${topic}`);
              else console.warn(`  ⚠️ Falha ao inscrever em ${topic}:`, err.message);
            });
          });

          this.callbacks.onConnect?.();
          resolve();
        });

        this.client.on('message', (topic, message) => {
          const raw = message.toString();
          let payload: string | object = raw;
          try { payload = JSON.parse(raw); } catch { /* keep as string */ }
          console.log(`📨 MQTT [${topic}]:`, typeof payload === 'object' ? payload : raw.slice(0, 100));
          this.callbacks.onMessage?.(topic, payload);
        });

        this.client.on('error', (err) => {
          clearTimeout(connectTimer);
          console.error('❌ Erro MQTT:', err.message);
          this.callbacks.onError?.(err);
          reject(err);
        });

        this.client.on('close', () => {
          console.log('🔌 MQTT desconectado');
          this.callbacks.onClose?.();
        });

        this.client.on('reconnect', () => {
          console.log('🔄 MQTT tentando reconectar...');
          this.callbacks.onReconnect?.();
        });

      } catch (err) {
        reject(err as Error);
      }
    });
  }

  // ─── Publish ───

  publish(topic: string, message: string | object, qos: 0 | 1 | 2 = 0): void {
    if (!this.client?.connected) {
      console.warn('⚠️ MQTT não conectado — publicação ignorada');
      return;
    }
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    console.log(`📤 MQTT → ${topic}:`, payload.slice(0, 80));
    this.client.publish(topic, payload, { qos }, (err) => {
      if (err) console.error('❌ Erro ao publicar:', err.message);
    });
  }

  // ─── Robot Commands ───

  ping(serial = ROBOT_SERIAL): void {
    const topics = [
      `robot/${serial}/cmd`,
      `csjbot/${serial}/cmd`,
      'alphabot/cmd',
    ];
    topics.forEach(t => this.publish(t, { cmd: 'ping', timestamp: Date.now() }));
  }

  requestStatus(serial = ROBOT_SERIAL): void {
    this.publish(`robot/${serial}/status/request`, { timestamp: Date.now() });
    this.publish(`csjbot/${serial}/status/request`, { timestamp: Date.now() });
  }

  startCalibration(
    sensors = ['imu', 'magnetometer', 'odometer', 'lidar', 'camera', 'battery', 'temperature'],
    serial = ROBOT_SERIAL
  ): void {
    this.publish(`robot/${serial}/calibration/start`, { sensors, timestamp: Date.now() });
    this.publish(`csjbot/${serial}/calibration/start`, { sensors, timestamp: Date.now() });
  }

  stopCalibration(serial = ROBOT_SERIAL): void {
    this.publish(`robot/${serial}/calibration/stop`, { timestamp: Date.now() });
  }

  resetCalibration(serial = ROBOT_SERIAL): void {
    this.publish(`robot/${serial}/calibration/reset`, { timestamp: Date.now() });
  }

  move(direction: 'forward' | 'backward' | 'left' | 'right' | 'stop', speed = 0.3, duration = 1000, serial = ROBOT_SERIAL): void {
    if (direction === 'stop') {
      this.publish(`robot/${serial}/movement/stop`, { timestamp: Date.now() });
    } else {
      this.publish(`robot/${serial}/movement/${direction}`, { speed, duration, timestamp: Date.now() });
    }
  }

  rotate(direction: 'left' | 'right', speed = 0.3, duration = 1000, serial = ROBOT_SERIAL): void {
    this.publish(`robot/${serial}/movement/rotate_${direction}`, { speed, duration, timestamp: Date.now() });
  }

  emergencyStop(serial = ROBOT_SERIAL): void {
    this.publish(`robot/${serial}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
    this.publish(`csjbot/${serial}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
  }

  // ─── HTTP API Fallback ───

  static async probeHttpApi(ip: string, timeoutMs = 5000): Promise<boolean> {
    const endpoints = [`/api/enterPage`, `/api/getAnswerV3`];
    for (const path of endpoints) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const res = await fetch(`http://${ip}${path}`, {
          method: 'GET',
          signal: ctrl.signal,
          cache: 'no-cache',
        });
        clearTimeout(timer);
        if (res.status < 500) return true;
      } catch { /* ignorar */ }
    }
    return false;
  }

  disconnect(): void {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.brokerUrl = '';
      console.log('✅ MQTT desconectado');
    }
  }
}
