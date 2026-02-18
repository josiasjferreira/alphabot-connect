/// <reference types="web-bluetooth" />
/**
 * @file BluetoothCalibrationBridge.ts
 * @brief Ponte Bluetooth BLE entre Aplicativo Web e Robô CSJBot para calibração de sensores
 * @version 1.0.0
 */

// GATT Service & Characteristic UUIDs (match firmware)
const CALIB_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const CALIB_CMD_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const CALIB_STATE_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
const CALIB_PROGRESS_UUID = '0000fff3-0000-1000-8000-00805f9b34fb';
const CALIB_DATA_UUID = '0000fff4-0000-1000-8000-00805f9b34fb';
const CALIB_ERROR_UUID = '0000fff5-0000-1000-8000-00805f9b34fb';

export type SensorId = 'imu' | 'magnetometer' | 'odometer' | 'lidar' | 'camera' | 'battery' | 'temperature';
export const ALL_SENSORS: SensorId[] = ['imu', 'magnetometer', 'odometer', 'lidar', 'camera', 'battery', 'temperature'];

export interface CalibrationData {
  status: number; // 0=invalid, 1=valid, 2=needs_recalibration
  timestamp: number;
  calibrationCount: number;
  imu: { biasX: number; biasY: number; biasZ: number; scaleX: number; scaleY: number; scaleZ: number };
  magnetometer: { offsetX: number; offsetY: number; offsetZ: number; scaleX: number; scaleY: number; scaleZ: number };
  odometer: { pulsesPerMeterLeft: number; pulsesPerMeterRight: number };
  lidar: { offsetDistance: number; angleOffset: number };
  camera: { focalLength: number; principalPointX: number; principalPointY: number; distortionK1: number; distortionK2: number };
  battery: { voltageOffset: number; voltageScale: number };
  temperature: { offset: number };
}

export interface CalibrationProgress {
  progress: number; // 0-100
  currentSensor: string;
  message: string;
}

export interface CalibrationState {
  state: number;
  stateName: string;
  timestamp: number;
}

export type CalibrationEventHandler<T> = (data: T) => void;

export class BluetoothCalibrationBridge {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
  private stateChar: BluetoothRemoteGATTCharacteristic | null = null;
  private progressChar: BluetoothRemoteGATTCharacteristic | null = null;
  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;

  public onProgressUpdate: CalibrationEventHandler<CalibrationProgress> | null = null;
  public onStateChange: CalibrationEventHandler<CalibrationState> | null = null;
  public onComplete: CalibrationEventHandler<CalibrationData> | null = null;
  public onError: CalibrationEventHandler<string> | null = null;
  public onLog: CalibrationEventHandler<string> | null = null;

  private log(msg: string) {
    console.log(`[CalibBridge] ${msg}`);
    this.onLog?.(msg);
  }

  /** Check if Web Bluetooth API is available */
  static isAvailable(): boolean {
    return !!(navigator as any).bluetooth;
  }

  /** Connect to the robot's calibration BLE service */
  async connect(): Promise<void> {
    if (!BluetoothCalibrationBridge.isAvailable()) {
      throw new Error('Web Bluetooth API não disponível neste navegador');
    }

    this.log('Solicitando dispositivo BLE...');

    this.device = await (navigator as any).bluetooth.requestDevice({
      filters: [
        { services: [CALIB_SERVICE_UUID] },
        { namePrefix: 'CSJBot' },
        { namePrefix: 'Ken' },
        { namePrefix: 'CT300' },
      ],
      optionalServices: [CALIB_SERVICE_UUID],
    });

    if (!this.device) throw new Error('Nenhum dispositivo selecionado');
    this.log(`Dispositivo: ${this.device.name || this.device.id}`);

    this.device.addEventListener('gattserverdisconnected', () => {
      this.log('Dispositivo desconectado');
      this.server = null;
    });

    this.server = await this.device.gatt!.connect();
    this.log('GATT conectado');

    const service = await this.server.getPrimaryService(CALIB_SERVICE_UUID);
    this.log('Serviço de calibração encontrado');

    // Get all characteristics
    this.cmdChar = await service.getCharacteristic(CALIB_CMD_UUID);
    this.stateChar = await service.getCharacteristic(CALIB_STATE_UUID);
    this.progressChar = await service.getCharacteristic(CALIB_PROGRESS_UUID);
    this.dataChar = await service.getCharacteristic(CALIB_DATA_UUID);

    // Subscribe to notifications
    await this.stateChar.startNotifications();
    this.stateChar.addEventListener('characteristicvaluechanged', this.handleStateNotification);

    await this.progressChar.startNotifications();
    this.progressChar.addEventListener('characteristicvaluechanged', this.handleProgressNotification);

    // Try subscribing to error characteristic
    try {
      const errorChar = await service.getCharacteristic(CALIB_ERROR_UUID);
      await errorChar.startNotifications();
      errorChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const val = (e.target as BluetoothRemoteGATTCharacteristic).value;
        if (val) {
          const msg = new TextDecoder().decode(val);
          this.onError?.(msg);
        }
      });
    } catch {
      this.log('Característica de erro não disponível (opcional)');
    }

    this.log('Conexão BLE completa ✓');
  }

  disconnect(): void {
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.server = null;
    this.device = null;
    this.cmdChar = null;
    this.stateChar = null;
    this.progressChar = null;
    this.dataChar = null;
    this.log('Desconectado');
  }

  isConnected(): boolean {
    return !!this.server?.connected;
  }

  /** Send a JSON command to the robot */
  private async sendCommand(cmd: Record<string, unknown>): Promise<void> {
    if (!this.cmdChar) throw new Error('Não conectado ao robô');
    const payload = new TextEncoder().encode(JSON.stringify(cmd));
    await this.cmdChar.writeValue(payload);
  }

  async startCalibration(sensors: SensorId[] = ALL_SENSORS): Promise<void> {
    await this.sendCommand({ cmd: 'start', sensors });
    this.log(`Calibração iniciada: ${sensors.join(', ')}`);
  }

  async stopCalibration(): Promise<void> {
    await this.sendCommand({ cmd: 'stop' });
    this.log('Calibração interrompida');
  }

  async resetCalibration(): Promise<void> {
    await this.sendCommand({ cmd: 'reset' });
    this.log('Calibração resetada para padrões de fábrica');
  }

  async getCalibrationData(): Promise<CalibrationData> {
    if (!this.dataChar) throw new Error('Não conectado ao robô');
    await this.sendCommand({ cmd: 'get_data' });
    await new Promise(r => setTimeout(r, 300));
    const value = await this.dataChar.readValue();
    const json = new TextDecoder().decode(value);
    return JSON.parse(json) as CalibrationData;
  }

  async getState(): Promise<CalibrationState> {
    if (!this.stateChar) throw new Error('Não conectado ao robô');
    await this.sendCommand({ cmd: 'get_state' });
    await new Promise(r => setTimeout(r, 200));
    const value = await this.stateChar.readValue();
    const json = new TextDecoder().decode(value);
    return JSON.parse(json) as CalibrationState;
  }

  // --- Notification handlers ---

  private handleStateNotification = (event: Event) => {
    const val = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!val) return;
    try {
      const state = JSON.parse(new TextDecoder().decode(val)) as CalibrationState;
      this.log(`Estado: ${state.stateName}`);
      this.onStateChange?.(state);
      if (state.stateName === 'ERROR') {
        this.onError?.('Erro durante calibração');
      }
    } catch { /* ignore parse errors */ }
  };

  private handleProgressNotification = (event: Event) => {
    const val = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!val) return;
    try {
      const progress = JSON.parse(new TextDecoder().decode(val)) as CalibrationProgress;
      this.log(`Progresso: ${progress.progress}% — ${progress.currentSensor}`);
      this.onProgressUpdate?.(progress);

      if (progress.progress >= 100 && this.onComplete) {
        this.getCalibrationData().then(data => this.onComplete?.(data)).catch(() => {});
      }
    } catch { /* ignore parse errors */ }
  };
}
