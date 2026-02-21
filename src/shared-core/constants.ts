/**
 * shared-core/constants.ts
 * Constantes da rede e hardware do CT300-H13307
 */

// ─── Rede ───

export const NETWORK = {
  /** Gateway do hotspot do robô */
  GATEWAY_IP: '192.168.99.1',
  /** IP interno do tablet Android (ConnectConstants.serverIp) */
  ROBOT_TABLET_IP: '192.168.99.101',
  /** IP do módulo SLAM Slamware */
  SLAM_IP: '192.168.99.2',
  /** IP do roteador RoboKen_Controle */
  ROUTER_IP: '192.168.0.1',
  /** IP do tablet (rede Tenda) */
  TABLET_TENDA_IP: '192.168.0.199',
  /** IP roteador Tenda */
  ROUTER_TENDA_IP: '192.168.2.5',
} as const;

export const PORTS = {
  HTTP: 80,
  MQTT_NATIVE: 1883,
  MQTT_WS: 9001,
  MQTT_WSS_MOSQUITTO: 8084,
  MQTT_WSS_STANDARD: 8883,
  SLAM_TCP: 1445,
  WEBSOCKET: 8080,
  EMQX_WS: 8083,
} as const;

// ─── Hardware ───

export const ROBOT = {
  SERIAL: 'H13307',
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
  MQTT_CONNECT: 12000,
  MQTT_PROBE: 3500,
  SLAM_CONNECT: 5000,
  HEARTBEAT_INTERVAL: 5000,
  POSITION_POLL: 1000,
  CALIBRATION_POLL: 2000,
} as const;

// ─── App ───

export const APP = {
  VERSION: '2.1.0',
  NAME: 'AlphaBot Companion',
  AUTHOR: 'Iascom',
  FOOTER: 'AlphaBot Companion v2.1.0 • Iascom',
} as const;
