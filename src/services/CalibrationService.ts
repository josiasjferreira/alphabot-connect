/**
 * CalibrationService — Orquestra calibração via HTTP + MQTT dual-channel
 * Baseado em calibration_api.ts e sensor_calibration.c do firmware
 */

import type {
  CalibrationData, CalibrationProgress, CalibrationResponse,
  SensorType, CalibrationState,
} from '@/shared-core/types/calibration';
import { calibrationStateToString, SUPPORTED_SENSORS } from '@/shared-core/types/calibration';
import { API_ENDPOINTS } from '@/shared-core/types/api';
import { SUB_TOPICS, PUB_TOPICS } from '@/shared-core/types/mqtt';
import { TIMEOUTS } from '@/shared-core/constants';

export class CalibrationService {
  private robotIP: string;
  private robotSN: string;
  private mqttPublish?: (topic: string, payload: object) => void;

  public onProgress?: (p: CalibrationProgress) => void;
  public onComplete?: (d: CalibrationData) => void;
  public onError?: (msg: string) => void;

  constructor(robotIP: string, robotSN: string) {
    this.robotIP = robotIP;
    this.robotSN = robotSN;
  }

  get httpBase() { return `http://${this.robotIP}`; }

  /** Attach MQTT publish function from useMQTT hook */
  attachMQTT(publishFn: (topic: string, payload: object) => void) {
    this.mqttPublish = publishFn;
  }

  // ─── HTTP Methods ───

  private async request<T>(method: string, path: string, body?: unknown): Promise<T | null> {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUTS.HTTP_DEFAULT);
      const res = await fetch(`${this.httpBase}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch { return null; }
  }

  async requestCalibration(sensors?: SensorType[]): Promise<CalibrationResponse | null> {
    const payload = { robotSN: this.robotSN, sensors: sensors ?? ['all'], timestamp: Date.now() };

    // Dual-channel: HTTP + MQTT
    this.mqttPublish?.(PUB_TOPICS.calibrationStart(this.robotSN), payload);
    return this.request<CalibrationResponse>('POST', API_ENDPOINTS.calibrationRequest, payload);
  }

  async getProgress(): Promise<CalibrationProgress | null> {
    return this.request('GET', API_ENDPOINTS.calibrationProgress);
  }

  async getData(): Promise<CalibrationData | null> {
    return this.request('GET', API_ENDPOINTS.calibrationData);
  }

  async reset(): Promise<CalibrationResponse | null> {
    this.mqttPublish?.(PUB_TOPICS.calibrationReset(this.robotSN), { timestamp: Date.now() });
    return this.request('POST', API_ENDPOINTS.calibrationReset, { robotSN: this.robotSN, timestamp: Date.now() });
  }

  async exportData(): Promise<CalibrationData | null> {
    return this.request('GET', API_ENDPOINTS.calibrationExport);
  }

  async importData(data: CalibrationData): Promise<CalibrationResponse | null> {
    return this.request('POST', API_ENDPOINTS.calibrationImport, { robotSN: this.robotSN, data, timestamp: Date.now() });
  }

  async requestSensorCalibration(sensor: SensorType): Promise<CalibrationResponse | null> {
    return this.request('POST', API_ENDPOINTS.calibrationSensor(sensor), { robotSN: this.robotSN, timestamp: Date.now() });
  }

  // ─── MQTT Message Handler ───

  handleMQTTMessage(topic: string, payload: object | string) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (topic.includes('calibration/progress')) {
      this.onProgress?.(data as CalibrationProgress);
    } else if (topic.includes('calibration/complete')) {
      this.onComplete?.(data as CalibrationData);
    } else if (topic.includes('calibration/error')) {
      this.onError?.((data as { error: string }).error);
    }
  }

  /** Get MQTT topics to subscribe for calibration */
  getSubscriptionTopics(): string[] {
    return [
      SUB_TOPICS.calibrationProgress(this.robotSN),
      SUB_TOPICS.calibrationComplete(this.robotSN),
      SUB_TOPICS.calibrationError(this.robotSN),
    ];
  }
}
