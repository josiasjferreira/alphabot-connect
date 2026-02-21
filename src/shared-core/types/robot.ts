/**
 * shared-core/types/robot.ts
 * DTOs do robô CT300-H13307 — mapeados dos Beans Java do Delivery_i18n_amy V5.3.8
 */

// ─── Estado do Robô ───

export type RobotOperationMode =
  | 'IDLE'
  | 'DELIVERY'
  | 'CHARGING'
  | 'PATROL'
  | 'RECEPTION'
  | 'BLESSING'
  | 'CICLE'
  | 'TAKESEAT'
  | 'EMERGENCY';

export interface RobotStateBean {
  sn: string;
  status: RobotOperationMode;
  batteryLevel: number;
  speed: number;
  x: number;
  y: number;
  theta: number;
  slamStatus: 'OK' | 'ERROR' | 'INITIALIZING';
  motorStatus: 'OK' | 'ERROR' | 'STOPPED';
  sensorStatus: 'OK' | 'ERROR' | 'CALIBRATING';
  timestamp: number;
}

// ─── Bateria ───

export interface ChargeBean {
  batteryPercent: number;
  isCharging: boolean;
  voltage: number;
  current: number;
  estimatedMinutes?: number;
}

// ─── Hardware ───

export interface HardwareBean {
  model: string;
  serialNumber: string;
  cpuTemp: number;
  diskSpace: number;
  diskUsed: number;
  ramTotal: number;
  ramUsed: number;
  kernelVersion?: string;
  uptime?: number;
}

// ─── Saúde ───

export interface HealthBean {
  slamStatus: 'OK' | 'ERROR';
  motorStatus: 'OK' | 'ERROR';
  sensorStatus: 'OK' | 'ERROR';
  networkStatus: 'OK' | 'ERROR';
  batteryHealth: 'GOOD' | 'DEGRADED' | 'CRITICAL';
}

// ─── Configuração ───

export interface RobotConfigBean {
  sn: string;
  name: string;
  model: string;
  firmware: string;
  locale: string;
  timezone: string;
  maxSpeed: number;
  chargePoint: { x: number; y: number; theta: number };
  mqttBroker: string;
  mqttPort: number;
}
