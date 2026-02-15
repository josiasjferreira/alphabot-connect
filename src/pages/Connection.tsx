import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2, CloudOff } from 'lucide-react';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import alphaIcon from '/icon-512.png';

const Connection = () => {
  const navigate = useNavigate();
  const { ip, port, connectionStatus, error, setConnection, setOfflineMode } = useRobotStore();
  const { connect } = useWebSocket();
  const [localIp, setLocalIp] = useState(ip);
  const [localPort, setLocalPort] = useState(port);

  const isValidIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(localIp);
  const isValidPort = /^\d{1,5}$/.test(localPort) && parseInt(localPort) > 0 && parseInt(localPort) <= 65535;

  const isPrivateIp = (ip: string) =>
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.0\.0\.1|localhost)/.test(ip);

  const handleConnect = () => {
    if (!isValidIp || !isValidPort) return;

    // Warn user if connecting to a non-local IP
    if (!isPrivateIp(localIp)) {
      const confirmed = window.confirm(
        `Atenção: Você está conectando a um IP externo (${localIp}). ` +
        'Isso pode expor comandos do robô a redes não confiáveis. Deseja continuar?'
      );
      if (!confirmed) return;
    }

    setConnection(localIp, localPort);
    connect();
    setTimeout(() => navigate('/dashboard'), 800);
  };

  const handleOffline = () => {
    setOfflineMode(true);
    navigate('/dashboard');
  };

  const isConnecting = connectionStatus === 'connecting';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center mb-8"
      >
        <motion.img
          src={alphaIcon}
          alt="AlphaBot"
          className="w-24 h-24 rounded-2xl mb-4"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <h1 className="text-2xl font-bold text-foreground">AlphaBot Companion</h1>
        <p className="text-sm text-muted-foreground mt-1">Robô de Telepresença CT300-H13307</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-sm space-y-4"
      >
        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-success' :
            connectionStatus === 'connecting' ? 'bg-warning animate-pulse' :
            connectionStatus === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
          }`} />
          <span className="text-sm text-muted-foreground font-medium">
            {connectionStatus === 'connected' ? 'Conectado' :
             connectionStatus === 'connecting' ? 'Conectando...' :
             connectionStatus === 'error' ? 'Erro de conexão' : 'Desconectado'}
          </span>
        </div>

        {/* IP Input */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">ENDEREÇO IP DO ROBÔ</label>
          <input
            type="text"
            value={localIp}
            onChange={(e) => setLocalIp(e.target.value)}
            placeholder="192.168.99.2"
            className={`w-full h-14 px-4 rounded-xl bg-card border-2 text-foreground text-base font-medium
              focus:outline-none focus:ring-2 focus:ring-primary/30
              ${isValidIp || !localIp ? 'border-border' : 'border-destructive'}`}
          />
        </div>

        {/* Port Input */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">PORTA</label>
          <input
            type="text"
            value={localPort}
            onChange={(e) => setLocalPort(e.target.value)}
            placeholder="8080"
            className={`w-full h-14 px-4 rounded-xl bg-card border-2 text-foreground text-base font-medium
              focus:outline-none focus:ring-2 focus:ring-primary/30
              ${isValidPort || !localPort ? 'border-border' : 'border-destructive'}`}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {/* Connect Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleConnect}
          disabled={!isValidIp || !isValidPort || isConnecting}
          className="w-full min-h-[56px] rounded-xl gradient-primary text-primary-foreground font-bold text-base
            shadow-button flex items-center justify-center gap-3
            disabled:opacity-50 disabled:shadow-none active:shadow-none transition-shadow"
        >
          {isConnecting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Wifi className="w-5 h-5" />
          )}
          {isConnecting ? 'CONECTANDO...' : 'CONECTAR ROBÔ'}
        </motion.button>

        {/* Offline Mode */}
        <button
          onClick={handleOffline}
          className="w-full min-h-[48px] rounded-xl border-2 border-border bg-card text-muted-foreground font-semibold text-sm
            flex items-center justify-center gap-2 active:bg-muted"
        >
          <CloudOff className="w-4 h-4" />
          Modo Offline (Simulação)
        </button>
      </motion.div>

      <p className="text-xs text-muted-foreground mt-8">v1.0.2 • Solar Life Energy & Iascom Ltda</p>
    </div>
  );
};

export default Connection;
