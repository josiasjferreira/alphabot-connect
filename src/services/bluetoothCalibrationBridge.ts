/// <reference types="web-bluetooth" />
/**
 * @file BluetoothCalibrationBridge.ts
 * @brief Ponte Bluetooth BLE + fallback SPP/WebSocket para calibração de sensores CSJBot
 * @version 2.0.0
 *
 * Multi-channel: BLE GATT → SPP (Bluetooth Serial) → WebSocket → HTTP
 * Integra com RobotCommandBridge para fallback automático.
 */

import { RobotCommandBridge } from './robotCommandBridge';

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
  status: number;
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
  progress: number;
  currentSensor: string;
  message: string;
}

export interface CalibrationState {
  state: number;
  stateName: string;
  timestamp: number;
}

export type CalibrationEventHandler<T> = (data: T) => void;

export type CalibrationChannel = 'ble' | 'spp' | 'websocket' | 'http' | 'none';

export class BluetoothCalibrationBridge {
  // BLE GATT
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private cmdChar: BluetoothRemoteGATTCharacteristic | null = null;
  private stateChar: BluetoothRemoteGATTCharacteristic | null = null;
  private progressChar: BluetoothRemoteGATTCharacteristic | null = null;
  private dataChar: BluetoothRemoteGATTCharacteristic | null = null;

  // Multi-channel fallback
  private commandBridge: RobotCommandBridge | null = null;
  private activeChannel: CalibrationChannel = 'none';

  // Callbacks
  public onProgressUpdate: CalibrationEventHandler<CalibrationProgress> | null = null;
  public onStateChange: CalibrationEventHandler<CalibrationState> | null = null;
  public onComplete: CalibrationEventHandler<CalibrationData> | null = null;
  public onError: CalibrationEventHandler<string> | null = null;
  public onLog: CalibrationEventHandler<string> | null = null;
  public onChannelChange: CalibrationEventHandler<CalibrationChannel> | null = null;
  public onDisconnected: (() => void) | null = null;

  private log(msg: string) {
    console.log(`[CalibBridge] ${msg}`);
    this.onLog?.(msg);
  }

  // ── Channel management ──

  /** Attach robotCommandBridge for SPP/WS/HTTP fallback */
  attachCommandBridge(bridge: RobotCommandBridge) {
    this.commandBridge = bridge;
    this.log('RobotCommandBridge anexado (fallback SPP/WS/HTTP disponível)');
  }

  getActiveChannel(): CalibrationChannel { return this.activeChannel; }

  private setChannel(ch: CalibrationChannel) {
    if (this.activeChannel !== ch) {
      this.activeChannel = ch;
      this.onChannelChange?.(ch);
      this.log(`Canal ativo: ${ch.toUpperCase()}`);
    }
  }

  /** Check if Web Bluetooth API is available */
  static isAvailable(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
  }

  // ── BLE Connection ──

  async connect(): Promise<void> {
    if (!BluetoothCalibrationBridge.isAvailable()) {
      // If BLE unavailable but command bridge exists, use fallback
      if (this.commandBridge?.hasAnyChannel()) {
        this.setChannel(this.commandBridge.getAvailableChannels()[0]?.toLowerCase() as CalibrationChannel || 'spp');
        this.log('Web Bluetooth indisponível — usando fallback via CommandBridge');
        return;
      }
      throw new Error('Web Bluetooth API não disponível e nenhum canal alternativo configurado');
    }

    this.log('Solicitando dispositivo BLE...');

    try {
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [CALIB_SERVICE_UUID] },
          { namePrefix: 'CSJBot' },
          { namePrefix: 'Ken' },
          { namePrefix: 'CT300' },
          { namePrefix: 'AlphaBot' },
        ],
        optionalServices: [CALIB_SERVICE_UUID],
      });

      if (!this.device) throw new Error('Nenhum dispositivo selecionado');
      this.log(`Dispositivo: ${this.device.name || this.device.id}`);

      this.device.addEventListener('gattserverdisconnected', () => {
        this.log('BLE desconectado');
        this.server = null;
        this.setChannel(this.commandBridge?.hasAnyChannel() ? 'spp' : 'none');
        this.onDisconnected?.();
      });

      this.server = await this.device.gatt!.connect();
      this.log('GATT conectado');

      const service = await this.server.getPrimaryService(CALIB_SERVICE_UUID);
      this.log('Serviço de calibração encontrado');

      this.cmdChar = await service.getCharacteristic(CALIB_CMD_UUID);
      this.stateChar = await service.getCharacteristic(CALIB_STATE_UUID);
      this.progressChar = await service.getCharacteristic(CALIB_PROGRESS_UUID);
      this.dataChar = await service.getCharacteristic(CALIB_DATA_UUID);

      await this.stateChar.startNotifications();
      this.stateChar.addEventListener('characteristicvaluechanged', this.handleStateNotification);

      await this.progressChar.startNotifications();
      this.progressChar.addEventListener('characteristicvaluechanged', this.handleProgressNotification);

      try {
        const errorChar = await service.getCharacteristic(CALIB_ERROR_UUID);
        await errorChar.startNotifications();
        errorChar.addEventListener('characteristicvaluechanged', (e: Event) => {
          const val = (e.target as BluetoothRemoteGATTCharacteristic).value;
          if (val) this.onError?.(new TextDecoder().decode(val));
        });
      } catch {
        this.log('Característica de erro não disponível (opcional)');
      }

      this.setChannel('ble');
      this.log('Conexão BLE completa ✓');
    } catch (err: any) {
      // BLE failed — try fallback
      if (this.commandBridge?.hasAnyChannel()) {
        const channels = this.commandBridge.getAvailableChannels();
        this.setChannel(channels[0]?.toLowerCase() as CalibrationChannel || 'spp');
        this.log(`BLE falhou (${err.message}) — usando fallback: ${this.activeChannel}`);
        return;
      }
      throw err;
    }
  }

  disconnect(): void {
    if (this.server?.connected) this.server.disconnect();
    this.server = null;
    this.device = null;
    this.cmdChar = null;
    this.stateChar = null;
    this.progressChar = null;
    this.dataChar = null;
    this.setChannel('none');
    this.log('Desconectado');
  }

  isConnected(): boolean {
    if (this.server?.connected) return true;
    // Connected via fallback channel
    if (this.activeChannel !== 'none' && this.activeChannel !== 'ble' && this.commandBridge?.hasAnyChannel()) return true;
    return false;
  }

  // ── Command dispatch (BLE first, then fallback) ──

  private async sendCommand(cmd: Record<string, unknown>): Promise<void> {
    // Try BLE GATT first
    if (this.cmdChar && this.server?.connected) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify(cmd));
        await this.cmdChar.writeValue(payload);
        this.setChannel('ble');
        this.log(`📤 BLE → ${JSON.stringify(cmd)}`);
        return;
      } catch (err) {
        this.log(`⚠ BLE writeValue falhou: ${(err as Error).message}`);
      }
    }

    // Fallback via RobotCommandBridge (SPP → WS → HTTP)
    if (this.commandBridge) {
      const bridgeCmd = {
        action: 'calibration',
        params: cmd,
        timestamp: Date.now(),
      };
      const result = await this.commandBridge.sendCommand(bridgeCmd);
      if (result.success) {
        this.setChannel(result.channel === 'bluetooth' ? 'spp' : result.channel as CalibrationChannel);
        this.log(`📤 ${result.channel.toUpperCase()} → calibration ${JSON.stringify(cmd)} (${result.latencyMs}ms)`);
        return;
      }
      this.log(`✗ Todos os canais falharam para comando: ${JSON.stringify(cmd)}`);
      throw new Error(`Falha em todos os canais: ${result.error}`);
    }

    throw new Error('Nenhum canal de comunicação disponível');
  }

  // ── Calibration operations ──

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
    // BLE direct read
    if (this.dataChar && this.server?.connected) {
      await this.sendCommand({ cmd: 'get_data' });
      await new Promise(r => setTimeout(r, 300));
      const value = await this.dataChar.readValue();
      const json = new TextDecoder().decode(value);
      return JSON.parse(json) as CalibrationData;
    }

    // Fallback: send command and parse bridge response
    if (this.commandBridge) {
      const result = await this.commandBridge.sendCommand({
        action: 'calibration',
        params: { cmd: 'get_data' },
        timestamp: Date.now(),
      });
      if (result.success && result.response) {
        try {
          return JSON.parse(result.response) as CalibrationData;
        } catch {
          this.log('⚠ Resposta do get_data não é JSON válido');
        }
      }
    }

    throw new Error('Não foi possível ler dados de calibração');
  }

  async getState(): Promise<CalibrationState> {
    if (this.stateChar && this.server?.connected) {
      await this.sendCommand({ cmd: 'get_state' });
      await new Promise(r => setTimeout(r, 200));
      const value = await this.stateChar.readValue();
      const json = new TextDecoder().decode(value);
      return JSON.parse(json) as CalibrationState;
    }

    if (this.commandBridge) {
      const result = await this.commandBridge.sendCommand({
        action: 'calibration',
        params: { cmd: 'get_state' },
        timestamp: Date.now(),
      });
      if (result.success && result.response) {
        try {
          return JSON.parse(result.response) as CalibrationState;
        } catch {}
      }
    }

    throw new Error('Não foi possível ler estado de calibração');
  }

  /** Parse incoming data from BT Serial or WebSocket for calibration responses */
  handleIncomingData(data: string) {
    try {
      const parsed = JSON.parse(data);
      // Progress notification
      if (parsed.progress !== undefined && parsed.currentSensor !== undefined) {
        const progress = parsed as CalibrationProgress;
        this.onProgressUpdate?.(progress);
        if (progress.progress >= 100 && this.onComplete) {
          this.getCalibrationData().then(d => this.onComplete?.(d)).catch(() => {});
        }
        return;
      }
      // State notification
      if (parsed.state !== undefined && parsed.stateName !== undefined) {
        const state = parsed as CalibrationState;
        this.onStateChange?.(state);
        if (state.stateName === 'ERROR') this.onError?.('Erro durante calibração');
        return;
      }
      // Error
      if (parsed.error) {
        this.onError?.(parsed.error);
      }
    } catch { /* not JSON or irrelevant data */ }
  }

  // ── BLE Notification handlers ──

  private handleStateNotification = (event: Event) => {
    const val = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!val) return;
    try {
      const state = JSON.parse(new TextDecoder().decode(val)) as CalibrationState;
      this.log(`Estado: ${state.stateName}`);
      this.onStateChange?.(state);
      if (state.stateName === 'ERROR') this.onError?.('Erro durante calibração');
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  };
}
