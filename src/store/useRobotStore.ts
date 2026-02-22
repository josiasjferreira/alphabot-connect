import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type RobotState as MachineState, type RobotEvent, transition, canTransition, getAvailableEvents } from '@/machine/robotStateMachine';

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
  bluetoothStatus: 'disconnected' | 'scanning' | 'paired' | 'connected' | 'error';
  bluetoothDevice: string | null;
  ip: string;
  port: string;
  authToken: string;
  error: string | null;
  offlineMode: boolean;
  robotName: string;
  status: RobotStatus;
  logs: LogEntry[];

  // State machine
  machineState: MachineState;
  lastEvent: RobotEvent | null;

  setConnection: (ip: string, port: string, authToken?: string) => void;
  setConnectionStatus: (status: RobotState['connectionStatus']) => void;
  setBluetoothStatus: (status: RobotState['bluetoothStatus'], device?: string | null) => void;
  setError: (error: string | null) => void;
  setOfflineMode: (offline: boolean) => void;
  updateStatus: (status: Partial<RobotStatus>) => void;
  addLog: (message: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;

  // State machine actions
  dispatchEvent: (event: RobotEvent) => boolean;
  canDispatch: (event: RobotEvent) => boolean;
  getAvailableEvents: () => RobotEvent[];
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
    (set, get) => ({
      connectionStatus: 'disconnected',
      bluetoothStatus: 'disconnected',
      bluetoothDevice: null,
      ip: '192.168.99.102',
      port: '8080',
      authToken: '',
      error: null,
      offlineMode: false,
      robotName: 'CT300-H13307',
      status: defaultStatus,
      logs: [],

      // State machine defaults
      machineState: 'IDLE',
      lastEvent: null,

      setConnection: (ip, port, authToken) => set({ ip, port, authToken: authToken ?? '' }),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus, error: connectionStatus === 'error' ? 'Falha na conexão' : null }),
      setBluetoothStatus: (bluetoothStatus, device) => set({ bluetoothStatus, bluetoothDevice: device ?? null }),
      setError: (error) => set({ error }),
      setOfflineMode: (offlineMode) => set({ offlineMode, connectionStatus: offlineMode ? 'connected' : 'disconnected' }),
      updateStatus: (partial) => set((s) => ({ status: { ...s.status, ...partial } })),
      addLog: (message, type = 'info') =>
        set((s) => ({
          logs: [{ timestamp: new Date(), message, type }, ...s.logs].slice(0, 50),
        })),
      clearLogs: () => set({ logs: [] }),

      // State machine actions
      dispatchEvent: (event) => {
        const current = get().machineState;
        const result = transition(current, event);
        if (result.success) {
          set({ machineState: result.newState, lastEvent: event });
          get().addLog(`Estado: ${result.previousState} → ${result.newState} (${event})`, 'info');
        } else {
          get().addLog(result.error || `Transição inválida: ${event}`, 'warning');
        }
        return result.success;
      },
      canDispatch: (event) => canTransition(get().machineState, event),
      getAvailableEvents: () => getAvailableEvents(get().machineState),
    }),
    {
      name: 'alphabot-store',
      partialize: (state) => ({
        ip: state.ip,
        port: state.port,
        authToken: state.authToken,
        bluetoothDevice: state.bluetoothDevice,
        bluetoothStatus: state.bluetoothStatus === 'connected' || state.bluetoothStatus === 'paired'
          ? 'disconnected' as const
          : state.bluetoothStatus,
      }),
    }
  )
);
