/**
 * shared-core/types/csjbot-sdk.ts
 * Tipos e tópicos do RobotSDK v2.4.0 — CSJBot Humanoid
 */

// ─── Motion ────────────────────────────────────────────────────────

export type MotionAction = 'head_left_right' | 'head_up_down' | 'left_hand' | 'right_hand';
export type MotionModel = 'alice' | 'alicebig';
export type MotionExecutor = 'processor' | 'vip' | 'resident';

/** Gestos nativos suportados pelo SDK (robot/motion/gesture) */
export type GestureType = 'wave' | 'point' | 'thumbsup' | 'nod';

export interface GestureCommand {
  gesture: GestureType;
  intensity: number; // 0.0 – 1.0
  timestamp: number;
}

export interface MotionCommand {
  action: MotionAction;
  model: MotionModel;
  executor: MotionExecutor;
  intensity: number; // 0.0 – 1.0
  timestamp: number;
}

export interface MotionHistoryEntry extends MotionCommand {
  id: string;
  status: 'sent' | 'ack' | 'error';
}

// ─── Sensor ────────────────────────────────────────────────────────

export interface IMUData {
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
}

export interface SensorPayload {
  imu: IMUData;
  distance: number;
  touch: boolean;
  timestamp: number;
}

// ─── Camera ────────────────────────────────────────────────────────

export type CameraEventType = 'CONNECT_SUCCESS' | 'PACKET' | 'DISCONNECT';

export interface CameraPacket {
  eventType: CameraEventType;
  payload: string; // base64
  timestamp: number;
}

// ─── Person Detection ──────────────────────────────────────────────

export interface DetectionBox {
  id: string;
  label: string;         // e.g. 'person', 'face'
  confidence: number;    // 0.0 – 1.0
  x: number;             // top-left X (pixels or 0-1 normalized)
  y: number;             // top-left Y
  width: number;
  height: number;
}

export interface DetectionPayload {
  detections: DetectionBox[];
  timestamp: number;
  frameId?: number;
}

// ─── MQTT Topics (SDK pattern) ─────────────────────────────────────

export const SDK_TOPICS = {
  // Camera
  CAMERA_START: 'robot/camera/start',
  CAMERA_STOP: 'robot/camera/stop',

  // Audio
  AUDIO_PLAY: 'robot/audio/play',
  AUDIO_TTS: 'robot/audio/tts',

  // Motion
  MOTION_CMD: 'robot/motion/cmd',
  MOTION_GESTURE: 'robot/motion/gesture',
  MOTION_STATUS: 'robot/motion/status',

  // Sensors
  SENSORS_IMU: 'robot/sensors/imu',
  SENSORS_DISTANCE: 'robot/sensors/distance',
  SENSORS_TOUCH: 'robot/sensors/touch',
  SENSORS_ALL: 'robot/sensors/+',

  // Detection
  DETECTION_PERSON: 'robot/detection/person',
  DETECTION_FACE: 'robot/detection/face',

  // Status
  STATUS: 'robot/status',
  TELEMETRY: 'robot/telemetry',
} as const;
