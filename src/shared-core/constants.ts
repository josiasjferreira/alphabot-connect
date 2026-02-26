/**
 * shared-core/constants.ts
 * Constantes da rede e hardware — AlphaBot Connect v3.0
 * Arquitetura PC-Centric (Mapa Final Confirmado)
 *
 * Topologia 192.168.99.0/24:
 *   .1   → Panda Router (Gateway Wi-Fi)
 *   .2   → SLAMWARE (Navegação / Mapeamento)
 *   .10  → PLACA ANDROID (Cérebro do robô, multimídia)
 *   .100 → PC (Broker MQTT + Web Server)
 *   .200 → Tablet (Interface de controle / app Lovable)
 *   .101 → AlphaBot firmware (DESCONSIDERADO)
 */

import { NETWORK_CONFIG, MQTT_CONFIG } from '@/config/mqtt';

// ─── Rede ───

export const NETWORK = {
  /** PC (Broker MQTT + Web Server) */
  BROKER_IP: NETWORK_CONFIG.PC_IP,
  /** Placa Android — Cérebro do robô (multimídia, TTS, display) */
  ANDROID_BOARD_IP: NETWORK_CONFIG.ANDROID_BOARD_IP,
  /** SLAMWARE — Navegação / mapeamento */
  SLAM_IP: NETWORK_CONFIG.SLAM_IP,
  /** Tablet (display secundário / app Lovable) */
  TABLET_IP: NETWORK_CONFIG.TABLET_IP,
  /** Panda Router — Gateway Wi-Fi */
  GATEWAY_IP: NETWORK_CONFIG.GATEWAY_IP,
  /** @deprecated — AlphaBot firmware APK (desconsiderado) */
  ROBOT_FIRMWARE_IP: NETWORK_CONFIG.ROBOT_FIRMWARE_IP,
  /** @deprecated — IPs removidos da arquitetura v3.0 */
  LEGACY_ROBOT_TABLET_IP: '192.168.99.197',
} as const;

export const PORTS = {
  HTTP: 80,
  MQTT_NATIVE: 1883,
  MQTT_WS: MQTT_CONFIG.WEBSOCKET_PORT,
  MQTT_WSS_MOSQUITTO: 8084,
  MQTT_WSS_STANDARD: 8883,
  SLAM_TCP: 1445,
  WEBSOCKET: 8080,
  /** Porta HTTP da placa Android (a confirmar via engenharia reversa) */
  ANDROID_HTTP: 80,
  /** Porta WebSocket da placa Android (a confirmar) */
  ANDROID_WS: 8080,
} as const;

// ─── Hardware ───

export const ROBOT = {
  SERIAL: MQTT_CONFIG.ROBOT_SERIAL,
  MODEL: 'CT300',
  NAME: 'CT300-H13307',
  MANUFACTURER: 'CSJBot',
} as const;

// ─── Firmware ───

export const FIRMWARE = {
  CALIB_MAGIC: 0xCAFEBABE,
  CALIB_EEPROM_ADDR: 0x1000,
  IMU_SAMPLES: 100,
  MAG_ROTATION_TIME_MS: 30000,
  LIDAR_SAMPLES: 50,
  ODOM_TEST_DISTANCE_MM: 1000,
} as const;

// ─── Timeouts ───

export const TIMEOUTS = {
  HTTP_DEFAULT: 10000,
  HTTP_LONG: 15000,
  MQTT_CONNECT: MQTT_CONFIG.CONNECT_TIMEOUT,
  MQTT_PROBE: 3500,
  SLAM_CONNECT: 5000,
  HEARTBEAT_INTERVAL: 5000,
  POSITION_POLL: 1000,
  CALIBRATION_POLL: 2000,
} as const;

// ─── App ───

export const APP = {
  VERSION: '3.0.1',
  NAME: 'AlphaBot Connect',
  AUTHOR: 'Iascom',
  FOOTER: 'AlphaBot Connect v3.0.1 • Iascom',
} as const;

// ─── Rede: Topologia v3.0 (Mapa Final Confirmado) ───

export const NETWORK_TOPOLOGY = {
  subnet: '192.168.99.0/24',
  devices: {
    gateway:      { ip: NETWORK_CONFIG.GATEWAY_IP,        role: 'Panda Router — Gateway Wi-Fi da rede do robô' },
    slamware:     { ip: NETWORK_CONFIG.SLAM_IP,            role: 'SLAMWARE — Navegação / mapeamento' },
    androidBoard: { ip: NETWORK_CONFIG.ANDROID_BOARD_IP,   role: 'PLACA ANDROID — Cérebro do robô (SO Android, multimídia)' },
    pc:           { ip: NETWORK_CONFIG.PC_IP,              role: 'PC — Broker MQTT + Web Server (Mosquitto)' },
    tablet:       { ip: NETWORK_CONFIG.TABLET_IP,          role: 'Tablet — Interface de controle (app Lovable)' },
    firmware:     { ip: NETWORK_CONFIG.ROBOT_FIRMWARE_IP,  role: 'AlphaBot firmware (DESCONSIDERADO)' },
  },
  mqtt: {
    port: 1883,
    wsPort: MQTT_CONFIG.WEBSOCKET_PORT,
    protocol: 'mqtt' as const,
    auth: 'anonymous' as const,
  },
} as const;
