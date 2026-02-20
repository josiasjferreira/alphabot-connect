/**
 * RobotMQTTClient — Connects to the CSJBot via MQTT over WebSocket.
 *
 * The CSJBot uses MQTT as its native protocol. This client connects to the
 * MQTT broker running on the robot's router (ws://192.168.0.1:1883) and
 * subscribes to all robot topics for real-time telemetry and control.
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

const ROBOT_TOPICS = [
  'robot/#',
  'csjbot/#',
  'alphabot/#',
  'slamware/#',
  'sensor/#',
  'status/#',
];

const ROBOT_SERIAL = 'H13307';

export class RobotMQTTClient {
  private client: MqttClient | null = null;
  private callbacks: MQTTCallbacks = {};
  private brokerUrl = 'ws://192.168.0.1:1883';

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  async connect(
    brokerUrl = 'ws://192.168.0.1:1883',
    callbacks: MQTTCallbacks = {}
  ): Promise<void> {
    this.callbacks = callbacks;
    this.brokerUrl = brokerUrl;

    console.log('🔌 ==========================================');
    console.log('🔌 MQTT — CONECTANDO');
    console.log(`🔌 Broker: ${brokerUrl}`);
    console.log('🔌 ==========================================');

    return new Promise((resolve, reject) => {
      try {
        this.client = mqtt.connect(brokerUrl, {
          clientId: `alphabot-web-${Date.now()}`,
          clean: true,
          connectTimeout: 12000,
          reconnectPeriod: 0, // No auto-reconnect — handled manually
          keepalive: 30,
          protocol: 'ws',
        });

        const connectTimer = setTimeout(() => {
          this.client?.end(true);
          reject(new Error(`Timeout: broker MQTT não respondeu em 12s (${brokerUrl})`));
        }, 13000);

        this.client.on('connect', () => {
          clearTimeout(connectTimer);
          console.log('✅ MQTT CONECTADO!');

          ROBOT_TOPICS.forEach(topic => {
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
          console.log(`📨 MQTT [${topic}]:`, payload);
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

  publish(topic: string, message: string | object, qos: 0 | 1 | 2 = 0): void {
    if (!this.client?.connected) {
      console.warn('⚠️ MQTT não conectado — publicação ignorada');
      return;
    }
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    console.log(`📤 MQTT → ${topic}:`, payload);
    this.client.publish(topic, payload, { qos }, (err) => {
      if (err) console.error('❌ Erro ao publicar:', err.message);
    });
  }

  // ─── Robot Commands ───

  ping(): void {
    const topics = [
      `robot/${ROBOT_SERIAL}/cmd`,
      `csjbot/${ROBOT_SERIAL}/cmd`,
      'alphabot/cmd',
    ];
    topics.forEach(t => this.publish(t, { cmd: 'ping', timestamp: Date.now() }));
  }

  startCalibration(sensors = ['imu', 'magnetometer', 'odometer', 'lidar', 'camera', 'battery', 'temperature']): void {
    this.publish(`robot/${ROBOT_SERIAL}/calibration/start`, { sensors, timestamp: Date.now() });
  }

  stopCalibration(): void {
    this.publish(`robot/${ROBOT_SERIAL}/calibration/stop`, { timestamp: Date.now() });
  }

  resetCalibration(): void {
    this.publish(`robot/${ROBOT_SERIAL}/calibration/reset`, { timestamp: Date.now() });
  }

  move(direction: 'forward' | 'backward' | 'left' | 'right' | 'stop', speed = 0.3, duration = 1000): void {
    if (direction === 'stop') {
      this.publish(`robot/${ROBOT_SERIAL}/movement/stop`, { timestamp: Date.now() });
    } else {
      this.publish(`robot/${ROBOT_SERIAL}/movement/${direction}`, { speed, duration, timestamp: Date.now() });
    }
  }

  rotate(direction: 'left' | 'right', speed = 0.3, duration = 1000): void {
    this.publish(`robot/${ROBOT_SERIAL}/movement/rotate_${direction}`, { speed, duration, timestamp: Date.now() });
  }

  emergencyStop(): void {
    this.publish(`robot/${ROBOT_SERIAL}/cmd`, { cmd: 'emergency_stop', force: true, timestamp: Date.now() });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      console.log('✅ MQTT desconectado');
    }
  }
}
