import { useState, useCallback } from 'react';
import {
  BluetoothDeviceInfo,
  BluetoothTestResult,
  isWebBluetoothAvailable,
  isNativeBtAvailable,
  listPairedSppDevices,
  scanBleDevices,
  testBleConnection,
  testSppConnection,
  classifyDevice,
} from '@/services/robotBluetoothScanner';

const BT_SAVED_ROBOT_KEY = 'alphabot-bt-robot-device';

export const useRobotBluetooth = () => {
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(BT_SAVED_ROBOT_KEY);
      return saved ? JSON.parse(saved).id : null;
    } catch { return null; }
  });
  const [testResults, setTestResults] = useState<BluetoothTestResult[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('PING');
  const [btAvailable, setBtAvailable] = useState<{ ble: boolean; spp: boolean } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const checkAvailability = useCallback(async () => {
    const ble = isWebBluetoothAvailable();
    const spp = await isNativeBtAvailable();
    setBtAvailable({ ble, spp });
    addLog(`BT disponível — BLE: ${ble ? 'Sim' : 'Não'}, SPP: ${spp ? 'Sim' : 'Não'}`);
    return { ble, spp };
  }, [addLog]);

  const scanDevices = useCallback(async () => {
    setScanning(true);
    addLog('Iniciando busca de dispositivos...');
    const avail = await checkAvailability();

    const found: BluetoothDeviceInfo[] = [];

    // Get SPP paired devices
    if (avail.spp) {
      addLog('Buscando dispositivos SPP pareados...');
      const sppDevices = await listPairedSppDevices();
      found.push(...sppDevices);
      addLog(`SPP: ${sppDevices.length} dispositivo(s) pareado(s)`);
    }

    // Scan BLE
    if (avail.ble) {
      addLog('Abrindo scanner BLE (selecione um dispositivo)...');
      const bleDevice = await scanBleDevices();
      if (bleDevice) {
        // Don't duplicate
        if (!found.some(d => d.id === bleDevice.id)) {
          found.push(bleDevice);
        }
        addLog(`BLE: Encontrado "${bleDevice.name}"`);
      } else {
        addLog('BLE: Nenhum dispositivo selecionado');
      }
    }

    if (!avail.ble && !avail.spp) {
      addLog('⚠️ Nenhuma interface Bluetooth disponível');
    }

    setDevices(found);
    setScanning(false);
  }, [addLog, checkAvailability]);

  const markAsRobot = useCallback((deviceId: string) => {
    setSelectedRobot(deviceId);
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      try {
        localStorage.setItem(BT_SAVED_ROBOT_KEY, JSON.stringify({ id: deviceId, name: device.name }));
      } catch {}
      addLog(`Dispositivo "${device.name}" marcado como robô`);
    }
  }, [devices, addLog]);

  const testDevice = useCallback(async (deviceId: string) => {
    setTesting(deviceId);
    const device = devices.find(d => d.id === deviceId);
    if (!device) {
      setTesting(null);
      return;
    }

    addLog(`Testando "${device.name}" (${device.mode})...`);

    let result: BluetoothTestResult;
    if (device.mode === 'spp') {
      result = await testSppConnection(device.address, testMessage);
    } else {
      result = await testBleConnection(device.id, testMessage);
    }

    // Classify
    const serviceType = result.success ? classifyDevice(result.response) : 'unknown';
    
    // Update device info
    setDevices(prev => prev.map(d =>
      d.id === deviceId ? {
        ...d,
        status: result.success ? 'connected' : 'error',
        serviceType,
        lastTestResponse: result.response,
        lastTestTime: Date.now(),
      } : d
    ));

    setTestResults(prev => [result, ...prev].slice(0, 20));
    addLog(`${result.success ? '✓' : '✗'} ${device.name}: ${result.response} (${result.latencyMs}ms)`);
    setTesting(null);
  }, [devices, testMessage, addLog]);

  return {
    devices,
    scanning,
    scanDevices,
    selectedRobot,
    markAsRobot,
    testDevice,
    testing,
    testResults,
    testMessage,
    setTestMessage,
    btAvailable,
    checkAvailability,
    logs,
  };
};
