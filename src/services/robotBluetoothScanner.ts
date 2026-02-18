/**
 * Robot Bluetooth Scanner Service
 * Discovers and tests Bluetooth devices (BLE + SPP) for robot sensor communication.
 * 
 * TODO: integrar canal Bluetooth com leitura/controle real de sensores quando protocolo for definido.
 */

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  address: string;
  rssi?: number;
  status: 'found' | 'paired' | 'connected' | 'error';
  mode: 'ble' | 'spp' | 'unknown';
  serviceType?: 'sensors' | 'control' | 'other' | 'unknown';
  lastTestResponse?: string;
  lastTestTime?: number;
}

export interface BluetoothTestResult {
  deviceId: string;
  success: boolean;
  response: string;
  latencyMs: number;
}

const SENSOR_KEYWORDS = ['sensor', 'lidar', 'imu', 'battery', 'temperature', 'status', 'ultrasonic'];

function classifyBtResponse(text: string): BluetoothDeviceInfo['serviceType'] {
  const lower = text.toLowerCase();
  if (SENSOR_KEYWORDS.some(k => lower.includes(k))) return 'sensors';
  if (['motor', 'move', 'speed', 'control'].some(k => lower.includes(k))) return 'control';
  return 'other';
}

// Nordic UART Service UUIDs
const UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const UART_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const GENERIC_SERIAL_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
const GENERIC_SERIAL_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';

export function isWebBluetoothAvailable(): boolean {
  return !!(navigator as any).bluetooth;
}

let BluetoothSerialPlugin: any = null;

export async function loadNativeBtPlugin(): Promise<any> {
  if (BluetoothSerialPlugin) return BluetoothSerialPlugin;
  try {
    const mod = await import('@e-is/capacitor-bluetooth-serial');
    BluetoothSerialPlugin = mod.BluetoothSerial;
    return BluetoothSerialPlugin;
  } catch {
    return null;
  }
}

export async function isNativeBtAvailable(): Promise<boolean> {
  try {
    const plugin = await loadNativeBtPlugin();
    if (!plugin) return false;
    const result = await plugin.isEnabled();
    return result?.enabled === true;
  } catch {
    return false;
  }
}

export async function listPairedSppDevices(): Promise<BluetoothDeviceInfo[]> {
  try {
    const plugin = await loadNativeBtPlugin();
    if (!plugin) return [];
    const result = await plugin.list();
    return (result?.devices || []).map((d: any) => ({
      id: d.address,
      name: d.name || 'Dispositivo SPP',
      address: d.address,
      status: 'paired' as const,
      mode: 'spp' as const,
    }));
  } catch {
    return [];
  }
}

export async function scanBleDevices(): Promise<BluetoothDeviceInfo | null> {
  try {
    const nav = navigator as any;
    if (!nav.bluetooth) return null;

    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [UART_SERVICE, GENERIC_SERIAL_SERVICE, 'generic_access', 'battery_service'],
    });

    if (!device) return null;

    return {
      id: device.id,
      name: device.name || 'Dispositivo BLE',
      address: device.id,
      status: 'found',
      mode: 'ble',
    };
  } catch {
    return null;
  }
}

export async function testBleConnection(deviceId: string, testMessage = 'PING'): Promise<BluetoothTestResult> {
  const start = Date.now();
  try {
    const nav = navigator as any;
    if (!nav.bluetooth) throw new Error('Web Bluetooth indisponível');

    // We need to request device again due to Web Bluetooth security model
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [UART_SERVICE, GENERIC_SERIAL_SERVICE, 'generic_access', 'battery_service'],
    });

    if (!device) throw new Error('Nenhum dispositivo selecionado');

    const server = await device.gatt?.connect();
    if (!server) throw new Error('GATT indisponível');

    // Try UART service
    let response = '';
    const serviceUUIDs = [UART_SERVICE, GENERIC_SERIAL_SERVICE];

    for (const svcUuid of serviceUUIDs) {
      try {
        const service = await server.getPrimaryService(svcUuid);
        if (svcUuid === UART_SERVICE) {
          const txChar = await service.getCharacteristic(UART_TX);
          const rxChar = await service.getCharacteristic(UART_RX);
          
          // Listen for response
          const responsePromise = new Promise<string>((resolve) => {
            const timeout = setTimeout(() => resolve('Conectado, sem resposta'), 3000);
            rxChar.startNotifications().then(() => {
              rxChar.addEventListener('characteristicvaluechanged', (e: any) => {
                clearTimeout(timeout);
                resolve(new TextDecoder().decode(e.target.value));
              });
            }).catch(() => { clearTimeout(timeout); resolve('Notificações indisponíveis'); });
          });

          // Send test message
          await txChar.writeValue(new TextEncoder().encode(testMessage + '\n'));
          response = await responsePromise;
          break;
        } else {
          const char = await service.getCharacteristic(GENERIC_SERIAL_CHAR);
          await char.writeValue(new TextEncoder().encode(testMessage + '\n'));
          response = 'Mensagem enviada via Generic Serial';
          break;
        }
      } catch {
        continue;
      }
    }

    if (!response) response = 'GATT conectado, nenhum serviço serial encontrado';
    
    device.gatt?.disconnect();
    return { deviceId, success: true, response, latencyMs: Date.now() - start };
  } catch (err) {
    return { deviceId, success: false, response: (err as Error).message, latencyMs: Date.now() - start };
  }
}

export async function testSppConnection(address: string, testMessage = 'PING'): Promise<BluetoothTestResult> {
  const start = Date.now();
  try {
    const plugin = await loadNativeBtPlugin();
    if (!plugin) throw new Error('Plugin SPP indisponível');

    await plugin.connect({ address });
    await plugin.write({ value: testMessage + '\n' });

    // Try reading response with timeout
    let response = '';
    try {
      const readPromise = plugin.readUntil({ delimiter: '\n' });
      const timeoutPromise = new Promise<{ data: string }>((resolve) =>
        setTimeout(() => resolve({ data: '' }), 3000)
      );
      const result = await Promise.race([readPromise, timeoutPromise]);
      response = result?.data || 'Conectado, sem resposta';
    } catch {
      response = 'Conectado, leitura indisponível';
    }

    try { await plugin.disconnect(); } catch {}

    return { deviceId: address, success: true, response, latencyMs: Date.now() - start };
  } catch (err) {
    return { deviceId: address, success: false, response: (err as Error).message, latencyMs: Date.now() - start };
  }
}

export function classifyDevice(response: string): BluetoothDeviceInfo['serviceType'] {
  if (!response) return 'unknown';
  return classifyBtResponse(response);
}
