import { useState, useCallback } from 'react';
import {
  PortScanResult,
  DEFAULT_PORTS,
  DEFAULT_IP,
  scanPort,
  testPortDetailed,
} from '@/services/robotConnectionScanner';

export interface ScanState {
  scanning: boolean;
  currentPort: number | null;
  progress: number;
  results: PortScanResult[];
}

export const useRobotConnectionScanner = () => {
  const [ip, setIp] = useState(DEFAULT_IP);
  const [ports, setPorts] = useState<number[]>(DEFAULT_PORTS);
  const [portsText, setPortsText] = useState(DEFAULT_PORTS.join(', '));
  const [timeoutMs, setTimeoutMs] = useState(3000);
  const [state, setState] = useState<ScanState>({
    scanning: false,
    currentPort: null,
    progress: 0,
    results: [],
  });
  const [detailResult, setDetailResult] = useState<{
    port: number;
    httpResponses: Array<{ path: string; status: number; body: string }>;
    wsResponse: string | null;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const parsePortsText = useCallback((text: string) => {
    setPortsText(text);
    const parsed = text
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0 && n <= 65535);
    setPorts(parsed.length > 0 ? parsed : DEFAULT_PORTS);
  }, []);

  const startScan = useCallback(async () => {
    setState({ scanning: true, currentPort: null, progress: 0, results: [] });

    const results: PortScanResult[] = [];
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      setState(prev => ({ ...prev, currentPort: port, progress: ((i) / ports.length) * 100 }));
      
      const result = await scanPort(ip, port, timeoutMs);
      results.push(result);
      setState(prev => ({ ...prev, results: [...results] }));
    }

    setState(prev => ({ ...prev, scanning: false, currentPort: null, progress: 100 }));
  }, [ip, ports, timeoutMs]);

  const testDetails = useCallback(async (port: number) => {
    setDetailLoading(true);
    setDetailResult(null);
    const result = await testPortDetailed(ip, port);
    setDetailResult({ port, ...result });
    setDetailLoading(false);
  }, [ip]);

  return {
    ip, setIp,
    portsText, parsePortsText,
    timeoutMs, setTimeoutMs,
    state,
    startScan,
    detailResult, detailLoading, testDetails,
  };
};
