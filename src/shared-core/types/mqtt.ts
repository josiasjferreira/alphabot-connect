/**
 * shared-core/types/mqtt.ts
 * Tópicos MQTT tipados e payloads — baseados na engenharia reversa
 */

import type { RobotStateBean, ChargeBean } from './robot';
import type { TaskBean } from './delivery';
import type { CalibrationProgress, CalibrationData } from './calibration';
import type { SlamPose } from './slam';

// ─── Serial padrão ───

export const DEFAULT_ROBOT_SERIAL = 'H13307';

// ─── Tópicos MQTT tipados ───

export function robotTopic(sn: string, path: string): string {
  return `robot/${sn}/${path}`;
}

export function csjbotTopic(sn: string, path: string): string {
  return `csjbot/${sn}/${path}`;
}

/** Tópicos que o app PUBLICA */
export const PUB_TOPICS = {
  status: (sn: string) => robotTopic(sn, 'status'),
  position: (sn: string) => robotTopic(sn, 'position'),
  battery: (sn: string) => robotTopic(sn, 'battery'),
  log: (sn: string) => robotTopic(sn, 'log'),
  calibrationStart: (sn: string) => robotTopic(sn, 'calibration/start'),
  calibrationStop: (sn: string) => robotTopic(sn, 'calibration/stop'),
  calibrationReset: (sn: string) => robotTopic(sn, 'calibration/reset'),
  movementDir: (sn: string, dir: string) => robotTopic(sn, `movement/${dir}`),
  movementStop: (sn: string) => robotTopic(sn, 'movement/stop'),
  cmd: (sn: string) => robotTopic(sn, 'cmd'),
  statusRequest: (sn: string) => robotTopic(sn, 'status/request'),
} as const;

/** Tópicos que o app ASSINA (recebe) */
export const SUB_TOPICS = {
  command: (sn: string) => robotTopic(sn, 'command'),
  taskNew: (sn: string) => robotTopic(sn, 'task/new'),
  calibrationProgress: (sn: string) => robotTopic(sn, 'calibration/progress'),
  calibrationComplete: (sn: string) => robotTopic(sn, 'calibration/complete'),
  calibrationError: (sn: string) => robotTopic(sn, 'calibration/error'),
  kitchenReady: () => 'kitchen/order/ready',
  robotWildcard: (sn: string) => `robot/${sn}/#`,
  csjbotWildcard: (sn: string) => `csjbot/${sn}/#`,
  slamware: () => 'slamware/#',
  sensor: () => 'sensor/#',
  statusAll: () => 'status/#',
} as const;

// ─── Payloads tipados por tópico ───

export interface MQTTPayloadMap {
  'status': RobotStateBean;
  'position': SlamPose;
  'battery': ChargeBean;
  'command': { cmd: string; params?: Record<string, unknown>; timestamp: number };
  'task/new': TaskBean;
  'calibration/progress': CalibrationProgress;
  'calibration/complete': CalibrationData;
  'calibration/error': { error: string; state: number };
  'movement/forward': { speed: number; duration: number; timestamp: number };
  'movement/backward': { speed: number; duration: number; timestamp: number };
  'movement/left': { speed: number; duration: number; timestamp: number };
  'movement/right': { speed: number; duration: number; timestamp: number };
  'movement/stop': { timestamp: number };
  'log': { level: string; message: string; timestamp: number };
}

// ─── Mensagem MQTT genérica ───

export interface MQTTMessage {
  topic: string;
  payload: string | object;
  ts: string;
  qos?: 0 | 1 | 2;
}
