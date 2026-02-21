/**
 * shared-core/types/calibration.ts
 * Contratos de calibração — mapeados de sensor_calibration.h e calibration_api.ts
 */

// ─── Enums (espelham CalibrationState_t do firmware C) ───

export enum CalibrationStatus {
  INVALID = 0,
  VALID = 1,
  NEEDS_RECALIBRATION = 2,
}

export enum CalibrationState {
  IDLE = 0,
  IMU_INIT = 1,
  IMU_RUNNING = 2,
  MAG_INIT = 3,
  MAG_RUNNING = 4,
  ODOM_INIT = 5,
  ODOM_RUNNING = 6,
  LIDAR_INIT = 7,
  LIDAR_RUNNING = 8,
  CAMERA_INIT = 9,
  CAMERA_RUNNING = 10,
  BATTERY_INIT = 11,
  BATTERY_RUNNING = 12,
  TEMP_INIT = 13,
  TEMP_RUNNING = 14,
  VALIDATE = 15,
  COMPLETE = 16,
  ERROR = 17,
}

// ─── Dados de sensor individual ───

export interface SensorCalibrationEntry {
  name: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  progress: number; // 0-100
  timestamp?: number;
  error?: string;
}

// ─── Dados completos de calibração (espelha SensorCalibration_t) ───

export interface CalibrationData {
  status: CalibrationStatus;
  state: CalibrationState;
  timestamp: number;
  calibrationCount: number;
  ageSeconds: number;

  // IMU (bias + scale)
  imuBiasX: number;
  imuBiasY: number;
  imuBiasZ: number;
  imuScaleX: number;
  imuScaleY: number;
  imuScaleZ: number;

  // Magnetometer (offset + scale)
  magOffsetX: number;
  magOffsetY: number;
  magOffsetZ: number;
  magScaleX: number;
  magScaleY: number;
  magScaleZ: number;

  // Odometer
  pulsesPerMeterLeft: number;
  pulsesPerMeterRight: number;

  // LiDAR
  lidarOffsetDistance: number;
  lidarAngleOffset: number;

  // Camera
  cameraFocalLength: number;
  cameraPrincipalPointX: number;
  cameraPrincipalPointY: number;
  cameraDistortionK1: number;
  cameraDistortionK2: number;

  // Battery
  batteryVoltageOffset: number;
  batteryVoltageScale: number;

  // Temperature
  tempOffset: number;
}

// ─── Progresso de calibração ───

export interface CalibrationProgress {
  state: CalibrationState;
  stateString: string;
  progress: number; // 0-100 global
  currentSensor: string;
  sensors: SensorCalibrationEntry[];
  estimatedTimeRemaining: number; // segundos
}

// ─── Resposta genérica de calibração ───

export interface CalibrationResponse {
  success: boolean;
  message: string;
  data?: CalibrationData;
  error?: string;
}

// ─── Sensores suportados ───

export const SUPPORTED_SENSORS = [
  'imu',
  'magnetometer',
  'odometer',
  'lidar',
  'camera',
  'battery',
  'temperature',
] as const;

export type SensorType = typeof SUPPORTED_SENSORS[number];

// ─── Limites de validação (do firmware) ───

export const CALIBRATION_LIMITS = {
  imuBiasMax: 2.0,       // m/s²
  magOffsetMax: 1000.0,
  lidarOffsetMax: 0.1,    // m
  tempOffsetMax: 10.0,    // °C
  batteryOffsetMax: 1.0,  // V
  odomErrorMax: 0.15,     // 15%
} as const;

// ─── Frequências recomendadas ───

export const CALIBRATION_SCHEDULE = {
  imu: { hours: 12, km: 0, description: 'A cada 12h ou antes de navegação crítica' },
  magnetometer: { hours: 168, km: 0, description: 'A cada 7 dias ou em novo ambiente' },
  odometer: { hours: 0, km: 100, description: 'A cada 100km ou mensalmente' },
  lidar: { hours: 24, km: 500, description: 'A cada 24h ou 500km' },
  camera: { hours: 720, km: 0, description: 'A cada 30 dias ou se movida' },
  battery: { hours: 0, km: 0, cycles: 100, description: 'A cada 100 ciclos de carga' },
  temperature: { hours: 4320, km: 0, description: 'A cada 6 meses' },
} as const;

// ─── State name helper ───

export function calibrationStateToString(state: CalibrationState): string {
  const map: Record<CalibrationState, string> = {
    [CalibrationState.IDLE]: 'Idle',
    [CalibrationState.IMU_INIT]: 'Inicializando IMU',
    [CalibrationState.IMU_RUNNING]: 'Calibrando IMU',
    [CalibrationState.MAG_INIT]: 'Inicializando Magnetômetro',
    [CalibrationState.MAG_RUNNING]: 'Calibrando Magnetômetro',
    [CalibrationState.ODOM_INIT]: 'Inicializando Odômetro',
    [CalibrationState.ODOM_RUNNING]: 'Calibrando Odômetro',
    [CalibrationState.LIDAR_INIT]: 'Inicializando LiDAR',
    [CalibrationState.LIDAR_RUNNING]: 'Calibrando LiDAR',
    [CalibrationState.CAMERA_INIT]: 'Inicializando Câmera',
    [CalibrationState.CAMERA_RUNNING]: 'Calibrando Câmera',
    [CalibrationState.BATTERY_INIT]: 'Inicializando Bateria',
    [CalibrationState.BATTERY_RUNNING]: 'Calibrando Bateria',
    [CalibrationState.TEMP_INIT]: 'Inicializando Temperatura',
    [CalibrationState.TEMP_RUNNING]: 'Calibrando Temperatura',
    [CalibrationState.VALIDATE]: 'Validando',
    [CalibrationState.COMPLETE]: 'Completo',
    [CalibrationState.ERROR]: 'Erro',
  };
  return map[state] || 'Desconhecido';
}
