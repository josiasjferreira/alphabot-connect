import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { NETWORK_CONFIG, MQTT_CONFIG } from '@/config/mqtt';
import { useMQTT } from '@/hooks/useMQTT';
import { Network, Monitor, Bot, Tablet, Router, ChevronDown, ChevronUp } from 'lucide-react';

interface DeviceStatus {
  name: string;
  ip: string;
  role: string;
  icon: React.ReactNode;
  status: 'online' | 'offline' | 'unknown';
}

const NetworkInfo = () => {
  const { isConnected, brokerUrl } = useMQTT();
  const [expanded, setExpanded] = useState(false);
  const [devices, setDevices] = useState<DeviceStatus[]>([
    { name: 'PC (Broker)', ip: NETWORK_CONFIG.PC_IP, role: 'Broker MQTT + Servidor Web', icon: <Monitor className="w-4 h-4" />, status: 'unknown' },
    { name: 'Robô H13307', ip: NETWORK_CONFIG.ROBOT_IP, role: 'AlphaBot (controlado)', icon: <Bot className="w-4 h-4" />, status: 'unknown' },
    { name: 'Tablet', ip: NETWORK_CONFIG.TABLET_IP, role: 'Display secundário (browser)', icon: <Tablet className="w-4 h-4" />, status: 'unknown' },
    { name: 'Gateway', ip: NETWORK_CONFIG.GATEWAY_IP, role: 'Router Wi-Fi "Robo"', icon: <Router className="w-4 h-4" />, status: 'unknown' },
  ]);

  // Update PC broker status based on MQTT connection
  useEffect(() => {
    setDevices(prev => prev.map(d =>
      d.ip === NETWORK_CONFIG.PC_IP ? { ...d, status: isConnected ? 'online' : 'offline' } : d
    ));
  }, [isConnected]);

  const statusIcon = (s: DeviceStatus['status']) => {
    if (s === 'online') return '🟢';
    if (s === 'offline') return '🔴';
    return '⚪';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-2xl border border-border p-4 shadow-card"
    >
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Network className="w-4 h-4 text-primary" />
          Topologia de Rede
        </h2>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="bg-muted/30 rounded-xl p-3 space-y-2 font-mono text-xs">
            {devices.map(d => (
              <div key={d.ip} className="flex items-center gap-2">
                <span>{statusIcon(d.status)}</span>
                <span className="text-muted-foreground">{d.icon}</span>
                <span className="font-semibold text-foreground">{d.name}</span>
                <span className="ml-auto text-muted-foreground">{d.ip}</span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-muted-foreground space-y-0.5 mt-2">
            <p>Broker MQTT: <span className="text-foreground font-mono">{MQTT_CONFIG.WEBSOCKET_URL}</span></p>
            <p>Serial: <span className="text-foreground font-mono">{MQTT_CONFIG.ROBOT_SERIAL}</span></p>
            <p>Wi-Fi: <span className="text-foreground">Robo / RoboKen_Controle</span></p>
            <p>Subrede: <span className="text-foreground font-mono">192.168.99.0/24</span></p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default NetworkInfo;
