import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface RobotStatus {
  battery: number;
  temperature: number;
  wifiStrength: number;
  speed: number;
  orientation: number;
  posX: number;
  posY: number;
  motorLeft: number;
  motorRight: number;
  odometry: number;
  powerConsumption: number;
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

interface RobotState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  ip: string;
  port: string;
  authToken: string;
  error: string | null;
  offlineMode: boolean;
  robotName: string;
  status: RobotStatus;
  logs: LogEntry[];

  setConnection: (ip: string, port: string, authToken?: string) => void;
  setConnectionStatus: (status: RobotState['connectionStatus']) => void;
  setError: (error: string | null) => void;
  setOfflineMode: (offline: boolean) => void;
  updateStatus: (status: Partial<RobotStatus>) => void;
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
}

const defaultStatus: RobotStatus = {
  battery: 85,
  temperature: 38,
  wifiStrength: 4, // 0-5 scale
  speed: 0,
  orientation: 0,
  posX: 5.2,
  posY: 3.8,
  motorLeft: 0,
  motorRight: 0,
  odometry: 125.3,
  powerConsumption: 12,
};

export const useRobotStore = create<RobotState>()(
  persist(
    (set) => ({
      connectionStatus: 'disconnected',
      ip: '192.168.99.2',
      port: '8080',
      authToken: '',
      error: null,
      offlineMode: false,
      robotName: 'CT300-H13307',
      status: defaultStatus,
      logs: [],

      setConnection: (ip, port, authToken) => set({ ip, port, authToken: authToken ?? '' }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus, error: connectionStatus === 'error' ? 'Falha na conexão' : null }),
      setError: (error) => set({ error }),
      setOfflineMode: (offlineMode) => set({ offlineMode, connectionStatus: offlineMode ? 'connected' : 'disconnected' }),
      updateStatus: (partial) => set((s) => ({ status: { ...s.status, ...partial } })),
      addLog: (message, type = 'info') =>
        set((s) => ({
          logs: [{ timestamp: new Date(), message, type }, ...s.logs].slice(0, 50),
        })),
      clearLogs: () => set({ logs: [] }),
    }),
    {
      name: 'alphabot-store',
      partialize: (state) => ({ ip: state.ip, port: state.port, authToken: state.authToken }),
    }
  )
);
