/**
 * shared-core/constants.ts
 * Constantes da rede e hardware — AlphaBot Connect v2.0
 * Arquitetura PC-Centric (3 dispositivos)
 */

import { NETWORK_CONFIG, MQTT_CONFIG } from '@/config/mqtt';

// ─── Rede ───

export const NETWORK = {
  /** PC (Broker MQTT + Web Server) */
  BROKER_IP: NETWORK_CONFIG.PC_IP,
  /** Robô AlphaBot H13307 */
  ROBOT_IP: NETWORK_CONFIG.ROBOT_IP,
  /** Tablet (display secundário) */
  TABLET_IP: NETWORK_CONFIG.TABLET_IP,
  /** Gateway / Router "Robo" */
  GATEWAY_IP: NETWORK_CONFIG.GATEWAY_IP,
  /** SLAM IP — mantido para compatibilidade */
  SLAM_IP: '192.168.99.2',
  /** @deprecated — IPs removidos da arquitetura v2.0 */
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
  VERSION: '2.0.0',
  NAME: 'AlphaBot Connect',
  AUTHOR: 'Iascom',
  FOOTER: 'AlphaBot Connect v2.0.0 • Iascom',
} as const;

// ─── Rede: Topologia v2.0 ───

export const NETWORK_TOPOLOGY = {
  subnet: '192.168.99.0/24',
  devices: {
    pc:      { ip: NETWORK_CONFIG.PC_IP,      role: 'Broker MQTT + Web Server (Mosquitto)' },
    robot:   { ip: NETWORK_CONFIG.ROBOT_IP,    role: 'Robô AlphaBot H13307' },
    tablet:  { ip: NETWORK_CONFIG.TABLET_IP,   role: 'Display secundário (browser)' },
    gateway: { ip: NETWORK_CONFIG.GATEWAY_IP,  role: 'Router Wi-Fi "Robo"' },
  },
  mqtt: {
    port: 1883,
    wsPort: MQTT_CONFIG.WEBSOCKET_PORT,
    protocol: 'mqtt' as const,
    auth: 'anonymous' as const,
  },
} as const;
