import { useNavigate } from 'react-router-dom';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ArrowLeft, Battery, Wifi, WifiOff, Power } from 'lucide-react';

interface StatusHeaderProps {
  title: string;
  showBack?: boolean;
}

const StatusHeader = ({ title, showBack = true }: StatusHeaderProps) => {
  const navigate = useNavigate();
  const { connectionStatus, robotName, status } = useRobotStore();
  const { disconnect } = useWebSocket();

  const batteryColor = status.battery > 50 ? 'text-success' : status.battery > 20 ? 'text-warning' : 'text-destructive';
  const isConnected = connectionStatus === 'connected';

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-card border-b border-border shadow-card">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg active:bg-muted">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        )}
        <div>
          <h1 className="text-sm font-bold text-foreground leading-tight">{title}</h1>
          <p className="text-xs text-muted-foreground">{robotName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1 ${batteryColor}`}>
          <Battery className="w-4 h-4" />
          <span className="text-xs font-semibold">{status.battery}%</span>
        </div>
        <div className={isConnected ? 'text-success' : 'text-destructive'}>
          {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        </div>
        {isConnected && (
          <button
            onClick={() => { disconnect(); navigate('/'); }}
            className="p-2 rounded-lg text-muted-foreground active:bg-muted"
          >
            <Power className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};

export default StatusHeader;
