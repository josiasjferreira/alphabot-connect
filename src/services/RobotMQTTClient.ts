/**
 * RobotMQTTClient — Connects to the CSJBot via MQTT over WebSocket.
 *
 * Baseado na engenharia reversa dos APKs CSJBot (RobotSDK 2.4.0, Delivery 5.3.9):
 *
 * Topologia de rede final (Fev/2026):
 *   Broker MQTT:     192.168.99.197 (PC/Mosquitto v2.1.2, porta 1883)
 *   Robô CSJBot:     192.168.99.102
 *   Tablet Android:  192.168.99.200
 *   SLAM:            192.168.99.2
 *   Gateway:         192.168.99.1 (Tenda)
 *
 * Tópicos identificados nos APKs:
 *   robot/{SN}/calibration/progress  → Progresso de calibração
 *   robot/{SN}/calibration/complete  → Calibração concluída
 *   robot/{SN}/calibration/error     → Erro na calibração
 *   robot/{SN}/status                → Status geral
 *   robot/{SN}/sensors               → Dados de sensores
 *   robot/{SN}/movement/{dir}        → Controle de movimento
 *   csjbot/{SN}/#                    → Namespace alternativo
 *   alphabot/#                       → Namespace deste app
 *   slamware/#                       → Dados de SLAM
 *   sensor/#                         → Telemetria de sensores
 *   status/#                         → Status de subsistemas
 */

import mqtt, { type MqttClient } from 'mqtt';

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

// Tópicos confirmados via análise dos APKs CSJBot
const ROBOT_TOPICS = [
  'robot/#',
  'csjbot/#',
  'alphabot/#',
  'slamware/#',
  'sensor/#',
  'status/#',
];

// IPs candidatos — topologia final (Fev/2026)
const CANDIDATE_IPS = [
  '192.168.99.197', // Broker MQTT central (PC/Mosquitto)
  '192.168.99.102', // Robô CSJBot CT300-H13307
  '192.168.99.200', // Tablet Android
  '192.168.99.1',   // Gateway/Roteador Tenda
  '192.168.99.2',   // SLAM/Slamware
];

// Portas WebSocket MQTT mais comuns
const CANDIDATE_WS_PORTS = [9001, 1883, 8083, 8080];

export const ROBOT_SERIAL = 'H13307';

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

  /**
   * Testa uma única URL e retorna a latência se conectar.
   * Timeout curto (3s) para varredura rápida.
   */
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

  /**
   * Varre todos os IPs e portas candidatos e retorna o melhor broker.
   * Testa em paralelo por IP, sequencialmente por porta (para não sobrecarregar).
   */
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
      // Testa todos os IPs nesta porta em paralelo
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
          clientId: `alphabot-web-${Date.now()}`,
          clean: true,
          connectTimeout: 12000,
          reconnectPeriod: 0,
          keepalive: 30,
          protocol: 'ws',
        });

        const connectTimer = setTimeout(() => {
          this.client?.end(true);
          reject(new Error(
            `Timeout: broker MQTT não respondeu em 12s\n` +
            `URL testada: ${brokerUrl}\n\n` +
            `⚠️ Porta 1883 = TCP nativo (NÃO funciona em navegadores)\n` +
            `   Porta 9001 = WebSocket (necessária para navegadores)\n\n` +
            `Dicas:\n` +
            `• Configure Mosquitto com: listener 9001 / protocol websockets\n` +
            `• Verifique se está no Wi-Fi do robô (RoboKen_Controle)\n` +
            `• Tente usar a página "Config MQTT" para descoberta automática`
          ));
        }, 13000);

        this.client.on('connect', () => {
          clearTimeout(connectTimer);
          console.log('✅ MQTT CONECTADO!');

          // Inscrever em todos os tópicos do robô
          const topics = [
            ...ROBOT_TOPICS,
            `robot/${robotSerial}/#`,
            `csjbot/${robotSerial}/#`,
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

  // ─── Robot Commands (baseados nos endpoints identificados nos APKs) ───

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

  // ─── HTTP API Fallback (baseada nos endpoints identificados) ───

  /**
   * Tenta os endpoints HTTP reais identificados nos APKs CSJBot.
   * Base URL: http://192.168.99.102/api
   */
  static async probeHttpApi(ip: string, timeoutMs = 5000): Promise<boolean> {
    // Endpoints identificados nos APKs via Retrofit
    const endpoints = [
      `/api/enterPage`,
      `/api/getAnswerV3`,
    ];

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
        if (res.status < 500) return true; // Qualquer resposta (mesmo 404) = servidor ativo
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
