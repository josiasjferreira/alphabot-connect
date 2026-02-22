/**
 * shared-core/constants.ts
 * Constantes da rede e hardware do CT300-H13307
 */

// ─── Rede ───

export const NETWORK = {
  /** Gateway / Roteador Tenda da rede local */
  GATEWAY_IP: '192.168.99.1',
  /** Broker MQTT central — PC Windows com Mosquitto */
  BROKER_IP: '192.168.99.197',
  /** IP do robô CSJBot (CT300-H13307) */
  ROBOT_IP: '192.168.99.102',
  /** IP do tablet Android (cliente MQTT / monitoramento) */
  TABLET_IP: '192.168.99.200',
  /** IP do módulo SLAM Slamware */
  SLAM_IP: '192.168.99.2',
  /** @deprecated IP antigo do tablet — manter para fallback */
  LEGACY_ROBOT_TABLET_IP: '192.168.99.101',
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
  VERSION: '2.1.1',
  NAME: 'AlphaBot Companion',
  AUTHOR: 'Iascom',
  FOOTER: 'AlphaBot Companion v2.1.1 • Iascom',
} as const;

// ─── Rede: Topologia Final (Fev/2026) ───

export const NETWORK_TOPOLOGY = {
  /** Rede: 192.168.99.0/24 */
  subnet: '192.168.99.0/24',
  devices: {
    router:  { ip: '192.168.99.1',   role: 'Gateway / DHCP (Tenda)' },
    broker:  { ip: '192.168.99.197', role: 'Broker MQTT Central (PC/Mosquitto v2.1.2)' },
    robot:   { ip: '192.168.99.102', role: 'Robô CSJBot CT300-H13307' },
    tablet:  { ip: '192.168.99.200', role: 'Cliente MQTT (Android / IoT MQTT Panel)' },
    slam:    { ip: '192.168.99.2',   role: 'Módulo SLAM Slamware' },
  },
  mqtt: {
    port: 1883,
    protocol: 'mqtt' as const,
    auth: 'anonymous' as const,
  },
} as const;
