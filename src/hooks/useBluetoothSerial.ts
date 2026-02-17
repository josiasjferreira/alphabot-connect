import { useRef, useCallback, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';

/**
 * Bluetooth Serial (SPP) communication hook for CT300 robot.
 * 
 * Uses Web Bluetooth API with GATT Serial characteristics.
 * For full SPP support on Android, pair with native Capacitor plugin.
 * 
 * Protocol: JSON commands over BLE UART or classic SPP.
 * Command format: { type: 'move', angle: 0-360, speed: 0-100, rotation: 0-100 }
 */

// Nordic UART Service UUIDs (common BLE serial emulation)
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write
const UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify/Read

// Fallback generic UUIDs
const GENERIC_SERIAL_SERVICE = '0000ffe0-0000-1000-8000-00805f9b34fb';
const GENERIC_SERIAL_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';

export interface BluetoothCommand {
  type: 'move' | 'stop' | 'emergency_stop' | 'status_request';
  angle?: number;
  speed?: number;
  rotation?: number;
  timestamp: number;
}

interface SavedDevice {
  id: string;
  name: string;
  lastConnected: number;
}

const BT_DEVICE_STORAGE_KEY = 'alphabot-bt-device';

// Save last paired device for auto-reconnect
const saveDevice = (id: string, name: string) => {
  try {
    const device: SavedDevice = { id, name, lastConnected: Date.now() };
    localStorage.setItem(BT_DEVICE_STORAGE_KEY, JSON.stringify(device));
  } catch {}
};

export const getSavedDevice = (): SavedDevice | null => {
  try {
    const stored = localStorage.getItem(BT_DEVICE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const clearSavedDevice = () => {
  localStorage.removeItem(BT_DEVICE_STORAGE_KEY);
};

export const useBluetoothSerial = () => {
  const deviceRef = useRef<any>(null);
  const txCharRef = useRef<any>(null);
  const rxCharRef = useRef<any>(null);
  const { setBluetoothStatus, addLog, updateStatus } = useRobotStore();

  // Encode command to bytes for serial transmission
  const encodeCommand = useCallback((cmd: BluetoothCommand): string => {
    // CT300 protocol: JSON string terminated with newline
    return JSON.stringify(cmd) + '\n';
  }, []);

  // Try to find writable characteristic from known serial profiles
  const findSerialCharacteristics = useCallback(async (server: any) => {
    const serviceUUIDs = [UART_SERVICE_UUID, GENERIC_SERIAL_SERVICE];
    
    for (const serviceUUID of serviceUUIDs) {
      try {
        const service = await server.getPrimaryService(serviceUUID);
        addLog(`BT Serial: Serviço encontrado (${serviceUUID.substring(0, 8)}...)`, 'success');

        if (serviceUUID === UART_SERVICE_UUID) {
          try {
            txCharRef.current = await service.getCharacteristic(UART_TX_CHAR_UUID);
            rxCharRef.current = await service.getCharacteristic(UART_RX_CHAR_UUID);
            return true;
          } catch {}
        }

        if (serviceUUID === GENERIC_SERIAL_SERVICE) {
          try {
            const char = await service.getCharacteristic(GENERIC_SERIAL_CHAR);
            txCharRef.current = char;
            rxCharRef.current = char;
            return true;
          } catch {}
        }
      } catch {
        // Service not available, try next
      }
    }
    return false;
  }, [addLog]);

  // Listen for incoming data (status updates from robot)
  const startNotifications = useCallback(async () => {
    if (!rxCharRef.current) return;

    try {
      await rxCharRef.current.startNotifications();
      rxCharRef.current.addEventListener('characteristicvaluechanged', (event: any) => {
        try {
          const decoder = new TextDecoder();
          const value = decoder.decode(event.target.value);
          const parsed = JSON.parse(value);

          if (parsed.battery !== undefined || parsed.temperature !== undefined) {
            updateStatus(parsed);
            addLog('BT: Dados de telemetria recebidos', 'info');
          }
        } catch {
          // Non-JSON data, might be raw sensor data
        }
      });
      addLog('BT Serial: Notificações ativadas', 'success');
    } catch {
      addLog('BT Serial: Notificações indisponíveis (somente envio)', 'warning');
    }
  }, [addLog, updateStatus]);

  // Scan and connect to a Bluetooth device
  const scanAndConnect = useCallback(async () => {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        addLog('Bluetooth não suportado neste navegador', 'error');
        setBluetoothStatus('error');
        return false;
      }

      setBluetoothStatus('scanning');
      addLog('BT Serial: Buscando dispositivos...', 'info');

      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [UART_SERVICE_UUID, GENERIC_SERIAL_SERVICE, 'generic_access', 'battery_service'],
      });

      if (!device) {
        setBluetoothStatus('disconnected');
        return false;
      }

      const deviceName = device.name || 'Dispositivo BT';
      deviceRef.current = device;
      setBluetoothStatus('paired', deviceName);
      saveDevice(device.id, deviceName);
      addLog(`BT Serial: Pareado com ${deviceName}`, 'success');

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothStatus('disconnected');
        txCharRef.current = null;
        rxCharRef.current = null;
        addLog('BT Serial: Dispositivo desconectado', 'warning');
      });

      // Try GATT connection for serial communication
      try {
        addLog('BT Serial: Conectando GATT...', 'info');
        const server = await device.gatt?.connect();
        
        if (server) {
          const foundSerial = await findSerialCharacteristics(server);
          
          if (foundSerial) {
            setBluetoothStatus('connected', deviceName);
            addLog('BT Serial: Canal serial estabelecido ✓', 'success');
            await startNotifications();
          } else {
            // Connected but no serial service — still useful for pairing
            setBluetoothStatus('paired', deviceName);
            addLog('BT Serial: Conectado (serviço serial não encontrado — use SPP nativo)', 'warning');
          }
        }
      } catch {
        // Paired but GATT unavailable — classic BT may still work via native plugin
        setBluetoothStatus('paired', deviceName);
        addLog('BT Serial: Pareado (GATT indisponível — SPP via plugin nativo)', 'warning');
      }

      return true;
    } catch (err) {
      if ((err as Error).name === 'NotFoundError') {
        setBluetoothStatus('disconnected');
        addLog('BT Serial: Busca cancelada', 'info');
      } else {
        setBluetoothStatus('error');
        addLog(`BT Serial: ${(err as Error).message}`, 'error');
      }
      return false;
    }
  }, [addLog, setBluetoothStatus, findSerialCharacteristics, startNotifications]);

  // Send command via Bluetooth Serial
  const sendCommand = useCallback(async (cmd: BluetoothCommand) => {
    if (!txCharRef.current) {
      // Fallback: log command for future native SPP implementation
      addLog(`BT CMD [offline]: ${cmd.type} ${cmd.angle ? `A:${cmd.angle}° S:${cmd.speed}%` : ''}`, 'info');
      return false;
    }

    try {
      const encoded = encodeCommand(cmd);
      const encoder = new TextEncoder();
      const data = encoder.encode(encoded);

      // Split into 20-byte chunks (BLE MTU limit)
      for (let i = 0; i < data.length; i += 20) {
        const chunk = data.slice(i, i + 20);
        await txCharRef.current.writeValue(chunk);
      }
      return true;
    } catch (err) {
      addLog(`BT Serial: Erro ao enviar — ${(err as Error).message}`, 'error');
      return false;
    }
  }, [addLog, encodeCommand]);

  // Send movement command (convenience method)
  const sendMove = useCallback((angle: number, speed: number, rotation: number) => {
    return sendCommand({
      type: 'move',
      angle,
      speed,
      rotation,
      timestamp: Date.now(),
    });
  }, [sendCommand]);

  // Send stop command
  const sendStop = useCallback(() => {
    return sendCommand({
      type: 'stop',
      angle: 0,
      speed: 0,
      rotation: 0,
      timestamp: Date.now(),
    });
  }, [sendCommand]);

  // Send emergency stop
  const sendEmergencyStop = useCallback(() => {
    return sendCommand({
      type: 'emergency_stop',
      timestamp: Date.now(),
    });
  }, [sendCommand]);

  // Disconnect
  const disconnectBt = useCallback(() => {
    try {
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch {}
    deviceRef.current = null;
    txCharRef.current = null;
    rxCharRef.current = null;
    setBluetoothStatus('disconnected');
    addLog('BT Serial: Desconectado', 'info');
  }, [setBluetoothStatus, addLog]);

  // Auto-reconnect to last saved device on mount
  useEffect(() => {
    const savedDevice = getSavedDevice();
    if (savedDevice) {
      addLog(`BT: Último dispositivo: ${savedDevice.name}`, 'info');
      setBluetoothStatus('disconnected', savedDevice.name);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    scanAndConnect,
    sendCommand,
    sendMove,
    sendStop,
    sendEmergencyStop,
    disconnectBt,
    isSerialReady: !!txCharRef.current,
  };
};
