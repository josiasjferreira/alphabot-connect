import { useRef, useCallback, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';

/**
 * Bluetooth Serial (SPP + BLE UART) communication hook for CT300 robot.
 * 
 * Dual-mode: 
 *   1. Native SPP via @e-is/capacitor-bluetooth-serial (Android/iOS)
 *   2. Web Bluetooth BLE UART fallback (browser)
 * 
 * Protocol: JSON commands over serial, newline-terminated.
 */

// Nordic UART Service UUIDs (BLE serial emulation)
const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const UART_TX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const UART_RX_CHAR_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// Generic Serial UUIDs
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
  address: string;
  lastConnected: number;
  mode: 'spp' | 'ble';
}

const BT_DEVICE_STORAGE_KEY = 'alphabot-bt-device';

const saveDevice = (id: string, name: string, address: string, mode: 'spp' | 'ble') => {
  try {
    const device: SavedDevice = { id, name, address, lastConnected: Date.now(), mode };
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

// Dynamically import native plugin (only available in Capacitor)
let BluetoothSerial: any = null;
const loadNativePlugin = async () => {
  if (BluetoothSerial) return BluetoothSerial;
  try {
    const module = await import('@e-is/capacitor-bluetooth-serial');
    BluetoothSerial = module.BluetoothSerial;
    return BluetoothSerial;
  } catch {
    return null;
  }
};

const isNativeAvailable = async (): Promise<boolean> => {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) return false;
    const result = await plugin.isEnabled();
    return result?.enabled === true;
  } catch {
    return false;
  }
};

export const useBluetoothSerial = () => {
  const deviceRef = useRef<any>(null);
  const txCharRef = useRef<any>(null);
  const rxCharRef = useRef<any>(null);
  const sppAddressRef = useRef<string | null>(null);
  const modeRef = useRef<'spp' | 'ble' | null>(null);
  const { setBluetoothStatus, addLog, updateStatus } = useRobotStore();

  const encodeCommand = useCallback((cmd: BluetoothCommand): string => {
    return JSON.stringify(cmd) + '\n';
  }, []);

  // ============ NATIVE SPP METHODS ============

  const connectSPP = useCallback(async (address: string, deviceName: string): Promise<boolean> => {
    try {
      const plugin = await loadNativePlugin();
      if (!plugin) return false;

      addLog(`SPP: Conectando a ${deviceName} (${address})...`, 'info');
      setBluetoothStatus('scanning');

      await plugin.connect({ address });
      
      sppAddressRef.current = address;
      modeRef.current = 'spp';
      setBluetoothStatus('connected', deviceName);
      saveDevice(address, deviceName, address, 'spp');
      addLog(`SPP: Conectado a ${deviceName} ✓`, 'success');

      // Start listening for incoming data
      startSPPListener();

      return true;
    } catch (err) {
      addLog(`SPP: Erro — ${(err as Error).message}`, 'error');
      setBluetoothStatus('error');
      return false;
    }
  }, [addLog, setBluetoothStatus]);

  const startSPPListener = useCallback(async () => {
    try {
      const plugin = await loadNativePlugin();
      if (!plugin || !sppAddressRef.current) return;

      // Poll for data (plugin doesn't support events directly in all versions)
      const readLoop = async () => {
        try {
          const result = await plugin.readUntil({ delimiter: '\n' });
          if (result?.data) {
            try {
              const parsed = JSON.parse(result.data);
              if (parsed.battery !== undefined || parsed.temperature !== undefined) {
                updateStatus(parsed);
              }
            } catch {}
          }
          // Continue reading
          if (sppAddressRef.current) {
            setTimeout(readLoop, 100);
          }
        } catch {
          // Connection lost
          if (sppAddressRef.current) {
            setTimeout(readLoop, 500);
          }
        }
      };
      readLoop();
    } catch {}
  }, [updateStatus]);

  const sendSPP = useCallback(async (data: string): Promise<boolean> => {
    try {
      const plugin = await loadNativePlugin();
      if (!plugin || !sppAddressRef.current) return false;
      await plugin.write({ value: data });
      return true;
    } catch (err) {
      addLog(`SPP: Erro ao enviar — ${(err as Error).message}`, 'error');
      return false;
    }
  }, [addLog]);

  const disconnectSPP = useCallback(async () => {
    try {
      const plugin = await loadNativePlugin();
      if (plugin && sppAddressRef.current) {
        await plugin.disconnect();
      }
    } catch {}
    sppAddressRef.current = null;
  }, []);

  const listPairedSPPDevices = useCallback(async (): Promise<Array<{ name: string; address: string }>> => {
    try {
      const plugin = await loadNativePlugin();
      if (!plugin) return [];
      const result = await plugin.list();
      return result?.devices || [];
    } catch {
      return [];
    }
  }, []);

  // ============ WEB BLE METHODS ============

  const findSerialCharacteristics = useCallback(async (server: any) => {
    const serviceUUIDs = [UART_SERVICE_UUID, GENERIC_SERIAL_SERVICE];
    for (const serviceUUID of serviceUUIDs) {
      try {
        const service = await server.getPrimaryService(serviceUUID);
        addLog(`BLE: Serviço encontrado (${serviceUUID.substring(0, 8)}...)`, 'success');
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
      } catch {}
    }
    return false;
  }, [addLog]);

  const startBLENotifications = useCallback(async () => {
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
          }
        } catch {}
      });
      addLog('BLE: Notificações ativadas', 'success');
    } catch {
      addLog('BLE: Notificações indisponíveis', 'warning');
    }
  }, [addLog, updateStatus]);

  // ============ UNIFIED METHODS ============

  // Scan and connect — tries native SPP first, then Web BLE
  const scanAndConnect = useCallback(async () => {
    // Try native SPP first
    const nativeAvail = await isNativeAvailable();
    
    if (nativeAvail) {
      addLog('SPP: Plugin nativo detectado', 'success');
      setBluetoothStatus('scanning');
      
      try {
        const devices = await listPairedSPPDevices();
        
        if (devices.length > 0) {
          // Connect to first available paired device
          const device = devices[0];
          const success = await connectSPP(device.address, device.name || 'CT300');
          return success;
        } else {
          addLog('SPP: Nenhum dispositivo pareado encontrado', 'warning');
          // Enable discovery
          try {
            const plugin = await loadNativePlugin();
            await plugin?.enable();
            const devices2 = await listPairedSPPDevices();
            if (devices2.length > 0) {
              return await connectSPP(devices2[0].address, devices2[0].name || 'CT300');
            }
          } catch {}
        }
      } catch (err) {
        addLog(`SPP: ${(err as Error).message}`, 'error');
      }
    }

    // Fallback to Web Bluetooth BLE
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        addLog('Bluetooth não suportado neste dispositivo', 'error');
        setBluetoothStatus('error');
        return false;
      }

      setBluetoothStatus('scanning');
      addLog('BLE: Buscando dispositivos...', 'info');

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
      modeRef.current = 'ble';
      setBluetoothStatus('paired', deviceName);
      saveDevice(device.id, deviceName, device.id, 'ble');
      addLog(`BLE: Pareado com ${deviceName}`, 'success');

      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothStatus('disconnected');
        txCharRef.current = null;
        rxCharRef.current = null;
        addLog('BLE: Desconectado', 'warning');
      });

      try {
        const server = await device.gatt?.connect();
        if (server) {
          const foundSerial = await findSerialCharacteristics(server);
          if (foundSerial) {
            setBluetoothStatus('connected', deviceName);
            addLog('BLE: Canal serial estabelecido ✓', 'success');
            await startBLENotifications();
          } else {
            setBluetoothStatus('paired', deviceName);
            addLog('BLE: Pareado (use SPP nativo para serial)', 'warning');
          }
        }
      } catch {
        setBluetoothStatus('paired', deviceName);
        addLog('BLE: Pareado (GATT indisponível)', 'warning');
      }

      return true;
    } catch (err) {
      if ((err as Error).name === 'NotFoundError') {
        setBluetoothStatus('disconnected');
        addLog('BT: Busca cancelada', 'info');
      } else {
        setBluetoothStatus('error');
        addLog(`BT: ${(err as Error).message}`, 'error');
      }
      return false;
    }
  }, [addLog, setBluetoothStatus, findSerialCharacteristics, startBLENotifications, connectSPP, listPairedSPPDevices]);

  // Quick reconnect to last saved device
  const reconnectLastDevice = useCallback(async (): Promise<boolean> => {
    const saved = getSavedDevice();
    if (!saved) {
      addLog('BT: Nenhum dispositivo salvo para reconexão', 'warning');
      return false;
    }

    addLog(`BT: Reconectando a ${saved.name}...`, 'info');
    setBluetoothStatus('scanning', saved.name);

    if (saved.mode === 'spp') {
      return await connectSPP(saved.address, saved.name);
    }

    // BLE reconnect — Web Bluetooth requires user gesture for new pairing
    // but if the device is already known, try direct GATT connect
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        addLog('BT: Bluetooth indisponível', 'error');
        setBluetoothStatus('error');
        return false;
      }

      // Web Bluetooth doesn't support reconnecting without user gesture
      // So we trigger a new scan filtered by the saved name
      addLog(`BLE: Buscando ${saved.name}...`, 'info');
      const device = await nav.bluetooth.requestDevice({
        filters: [{ name: saved.name }],
        optionalServices: [UART_SERVICE_UUID, GENERIC_SERIAL_SERVICE, 'generic_access', 'battery_service'],
      });

      if (!device) {
        setBluetoothStatus('disconnected');
        return false;
      }

      deviceRef.current = device;
      modeRef.current = 'ble';
      const deviceName = device.name || saved.name;
      setBluetoothStatus('paired', deviceName);
      saveDevice(device.id, deviceName, device.id, 'ble');

      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothStatus('disconnected');
        txCharRef.current = null;
        rxCharRef.current = null;
      });

      try {
        const server = await device.gatt?.connect();
        if (server) {
          const foundSerial = await findSerialCharacteristics(server);
          if (foundSerial) {
            setBluetoothStatus('connected', deviceName);
            addLog(`BLE: Reconectado a ${deviceName} ✓`, 'success');
            await startBLENotifications();
            return true;
          }
        }
      } catch {}

      setBluetoothStatus('paired', deviceName);
      addLog(`BLE: Pareado com ${deviceName}`, 'success');
      return true;
    } catch (err) {
      if ((err as Error).name === 'NotFoundError') {
        setBluetoothStatus('disconnected');
        addLog('BT: Dispositivo não encontrado', 'warning');
      } else {
        setBluetoothStatus('error');
        addLog(`BT: ${(err as Error).message}`, 'error');
      }
      return false;
    }
  }, [addLog, setBluetoothStatus, connectSPP, findSerialCharacteristics, startBLENotifications]);

  // Send command (auto-selects SPP or BLE)
  const sendCommand = useCallback(async (cmd: BluetoothCommand) => {
    const encoded = encodeCommand(cmd);

    // Try SPP first
    if (modeRef.current === 'spp' && sppAddressRef.current) {
      return await sendSPP(encoded);
    }

    // Try BLE
    if (txCharRef.current) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(encoded);
        for (let i = 0; i < data.length; i += 20) {
          const chunk = data.slice(i, i + 20);
          await txCharRef.current.writeValue(chunk);
        }
        return true;
      } catch (err) {
        addLog(`BLE: Erro ao enviar — ${(err as Error).message}`, 'error');
        return false;
      }
    }

    // No active connection
    addLog(`BT CMD [offline]: ${cmd.type} ${cmd.angle ? `A:${cmd.angle}° S:${cmd.speed}%` : ''}`, 'info');
    return false;
  }, [addLog, encodeCommand, sendSPP]);

  const sendMove = useCallback((angle: number, speed: number, rotation: number) => {
    return sendCommand({ type: 'move', angle, speed, rotation, timestamp: Date.now() });
  }, [sendCommand]);

  const sendStop = useCallback(() => {
    return sendCommand({ type: 'stop', angle: 0, speed: 0, rotation: 0, timestamp: Date.now() });
  }, [sendCommand]);

  const sendEmergencyStop = useCallback(() => {
    return sendCommand({ type: 'emergency_stop', timestamp: Date.now() });
  }, [sendCommand]);

  const disconnectBt = useCallback(async () => {
    if (modeRef.current === 'spp') {
      await disconnectSPP();
    }
    try {
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch {}
    deviceRef.current = null;
    txCharRef.current = null;
    rxCharRef.current = null;
    modeRef.current = null;
    setBluetoothStatus('disconnected');
    addLog('BT: Desconectado', 'info');
  }, [setBluetoothStatus, addLog, disconnectSPP]);

  // Restore last device info on mount
  useEffect(() => {
    const savedDevice = getSavedDevice();
    if (savedDevice) {
      addLog(`BT: Último dispositivo: ${savedDevice.name} (${savedDevice.mode.toUpperCase()})`, 'info');
      setBluetoothStatus('disconnected', savedDevice.name);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    scanAndConnect,
    reconnectLastDevice,
    sendCommand,
    sendMove,
    sendStop,
    sendEmergencyStop,
    disconnectBt,
    isSerialReady: !!txCharRef.current || !!sppAddressRef.current,
    savedDevice: getSavedDevice(),
  };
};
