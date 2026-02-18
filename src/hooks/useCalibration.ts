import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BluetoothCalibrationBridge,
  CalibrationProgress,
  CalibrationData,
  CalibrationState,
  SensorId,
  ALL_SENSORS,
} from '@/services/bluetoothCalibrationBridge';

export const useCalibration = () => {
  const bridgeRef = useRef<BluetoothCalibrationBridge | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<CalibrationProgress | null>(null);
  const [calibData, setCalibData] = useState<CalibrationData | null>(null);
  const [calibState, setCalibState] = useState<CalibrationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [bleAvailable] = useState(() => BluetoothCalibrationBridge.isAvailable());

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  // Lazily create bridge
  const getBridge = useCallback(() => {
    if (!bridgeRef.current) {
      const b = new BluetoothCalibrationBridge();
      b.onLog = addLog;
      b.onProgressUpdate = (p) => {
        setProgress(p);
        setIsCalibrating(p.progress > 0 && p.progress < 100);
      };
      b.onStateChange = (s) => {
        setCalibState(s);
      };
      b.onComplete = (data) => {
        setCalibData(data);
        setIsCalibrating(false);
        addLog('Calibração completa!');
      };
      b.onError = (err) => {
        setError(err);
        setIsCalibrating(false);
        addLog(`Erro: ${err}`);
      };
      bridgeRef.current = b;
    }
    return bridgeRef.current;
  }, [addLog]);

  useEffect(() => {
    return () => {
      bridgeRef.current?.disconnect();
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      const bridge = getBridge();
      await bridge.connect();
      setIsConnected(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addLog(`Falha na conexão: ${msg}`);
    }
  }, [getBridge, addLog]);

  const disconnect = useCallback(() => {
    bridgeRef.current?.disconnect();
    setIsConnected(false);
    setProgress(null);
    setIsCalibrating(false);
    setCalibState(null);
  }, []);

  const startCalibration = useCallback(async (sensors: SensorId[] = ALL_SENSORS) => {
    try {
      setError(null);
      setCalibData(null);
      await getBridge().startCalibration(sensors);
      setIsCalibrating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [getBridge]);

  const stopCalibration = useCallback(async () => {
    try {
      setError(null);
      await getBridge().stopCalibration();
      setIsCalibrating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [getBridge]);

  const resetCalibration = useCallback(async () => {
    try {
      setError(null);
      await getBridge().resetCalibration();
      setCalibData(null);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [getBridge]);

  const fetchData = useCallback(async () => {
    try {
      const data = await getBridge().getCalibrationData();
      setCalibData(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [getBridge]);

  return {
    bleAvailable,
    isConnected,
    progress,
    calibData,
    calibState,
    error,
    isCalibrating,
    logs,
    connect,
    disconnect,
    startCalibration,
    stopCalibration,
    resetCalibration,
    fetchData,
  };
};
