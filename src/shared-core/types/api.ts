/**
 * shared-core/types/api.ts
 * Contratos de API REST — baseados em NetApiService.java (Retrofit)
 */

// ─── Response wrapper (equivale a ResponseBean<T> do Java) ───

export interface ResponseBean<T = unknown> {
  code: number;       // 200 = sucesso
  message: string;
  data: T;
}

// ─── Endpoints tipados ───

export const API_ENDPOINTS = {
  // Autenticação
  login: '/api/auth/login',
  
  // Configuração
  robotConfig: (sn: string) => `/api/config/robot/${sn}`,
  updateConfig: '/api/config/update',
  
  // Pedidos
  pendingOrders: '/api/order/pending',
  updateOrder: '/api/order/update',
  
  // Calibração
  calibrationRequest: '/api/calibration/request',
  calibrationProgress: '/api/calibration/progress',
  calibrationData: '/api/calibration/data',
  calibrationState: '/api/calibration/state',
  calibrationValid: '/api/calibration/valid',
  calibrationAge: '/api/calibration/age',
  calibrationReset: '/api/calibration/reset',
  calibrationExport: '/api/calibration/export',
  calibrationImport: '/api/calibration/import',
  calibrationValidate: '/api/calibration/validate',
  calibrationSensor: (sensor: string) => `/api/calibration/sensor/${sensor}`,
  
  // Movimento
  moveForward: '/api/movement/forward',
  moveBackward: '/api/movement/backward',
  moveRotate: '/api/movement/rotate',
  moveStop: '/api/movement/stop',
  moveGoto: '/api/movement/goto',
  moveStatus: '/api/movement/status',
  
  // Sensores
  sensorData: (type: string) => `/api/sensors/${type}`,
  
  // Mapa
  mapDownload: '/api/map/download',
  mapTables: '/api/map/tables',
  
  // Conteúdo
  ads: '/api/content/ads',
  specialties: '/api/content/specialties',
  
  // Sistema
  ping: '/api/ping',
  health: '/api/health',
  hardwareInfo: '/api/hardware/info',
  updateCheck: '/api/update/check',
  logsRecent: '/api/logs/recent',
  logsClear: '/api/logs/clear',
  
  // Endpoints CSJBot específicos
  enterPage: '/api/enterPage',
  getAnswerV3: '/api/getAnswerV3',
  
  // Tempo
  currentTime: '/api/time/current',
  
  // IoT
  uploadPoint: '/api/iot/point/upload',
  
  // Scripts de fala
  scriptList: '/api/script/list',
} as const;
