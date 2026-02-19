import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, MessageCircle, Map, BarChart3, Mic, Settings, ShoppingBag, Stethoscope, Package, Shield, Sparkles, Layers, Radio, Download, ScrollText, Camera, VideoOff, Users, Search, FlaskConical, MonitorPlay, Compass, Wrench, Wifi, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useInteractionSync } from '@/hooks/useInteractionSync';

type FeedSource = 'real' | 'simulation';

const CameraFeed = () => {
  const { t } = useTranslation();
  const { ip, port, connectionStatus, offlineMode } = useRobotStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [active, setActive] = useState(true);
  const [feedSource, setFeedSource] = useState<FeedSource>('simulation');
  const [fps, setFps] = useState(0);
  const frameRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const fpsCounterRef = useRef({ count: 0, lastTime: Date.now() });
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Try to connect to real camera WebSocket
  const connectRealFeed = useCallback(() => {
    if (offlineMode || !active) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    // Camera stream endpoint — the robot typically serves JPEG frames on /camera or /video
    const cameraUrl = `${protocol}://${ip}:${port}/camera`;

    try {
      const ws = new WebSocket(cameraUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[CameraFeed] Real camera WebSocket connected');
        setFeedSource('real');
      };

      ws.onmessage = (event) => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Track FPS
        fpsCounterRef.current.count++;
        const now = Date.now();
        if (now - fpsCounterRef.current.lastTime >= 1000) {
          setFps(fpsCounterRef.current.count);
          fpsCounterRef.current = { count: 0, lastTime: now };
        }

        // Handle binary JPEG frame
        if (event.data instanceof ArrayBuffer) {
          const blob = new Blob([event.data], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const img = imgRef.current || new Image();
          imgRef.current = img;
          img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas || !ctx) return;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawOverlay(ctx, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
        // Handle base64 JSON frame: { "frame": "data:image/jpeg;base64,..." }
        else if (typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data);
            const src = parsed.frame || parsed.image || parsed.data;
            if (src) {
              const img = imgRef.current || new Image();
              imgRef.current = img;
              img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas || !ctx) return;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                drawOverlay(ctx, canvas.width, canvas.height);
              };
              img.src = src.startsWith('data:') ? src : `data:image/jpeg;base64,${src}`;
            }
          } catch {
            // Not JSON, ignore
          }
        }
      };

      ws.onclose = () => {
        console.log('[CameraFeed] Real camera disconnected, falling back to simulation');
        setFeedSource('simulation');
        wsRef.current = null;
        // Retry after 5s
        reconnectTimeoutRef.current = setTimeout(connectRealFeed, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setFeedSource('simulation');
    }
  }, [ip, port, offlineMode, active]);

  // Draw HUD overlay on real feed
  const drawOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Corner brackets
    ctx.strokeStyle = 'rgba(0, 78, 137, 0.6)';
    ctx.lineWidth = 2;
    const bk = 15;
    [[4, 4, 1, 1], [w - 4, 4, -1, 1], [4, h - 4, 1, -1], [w - 4, h - 4, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(x, y + dy * bk); ctx.lineTo(x, y); ctx.lineTo(x + dx * bk, y); ctx.stroke();
    });

    // Crosshair
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = 'rgba(255, 107, 53, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 5, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 15, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 15); ctx.stroke();

    // Timestamp + REC
    ctx.fillStyle = 'rgba(255, 107, 53, 0.8)';
    ctx.font = '10px monospace';
    ctx.fillText(`CAM01 ${new Date().toLocaleTimeString()}`, 8, h - 8);
    ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
    ctx.beginPath(); ctx.arc(w - 48, 11, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 107, 53, 0.8)';
    ctx.fillText('LIVE', w - 42, 14);
  };

  // Attempt real connection on mount / when settings change
  useEffect(() => {
    if (active && !offlineMode && connectionStatus === 'connected') {
      connectRealFeed();
    }
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [active, offlineMode, connectionStatus, connectRealFeed]);

  // Simulation fallback
  useEffect(() => {
    if (!active || feedSource !== 'simulation' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      frameRef.current += 1;
      const f = frameRef.current;

      ctx.fillStyle = '#0a1628';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // Room shapes
      ctx.fillStyle = 'rgba(0, 78, 137, 0.08)';
      ctx.fillRect(20, 30, 80, 60);
      ctx.fillRect(w - 100, 20, 80, 50);
      ctx.fillRect(40, h - 70, 120, 40);

      // Scan line
      const scanY = (f * 2) % h;
      const gradient = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
      gradient.addColorStop(0, 'rgba(255, 107, 53, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 107, 53, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, scanY - 10, w, 20);

      // Crosshair
      const cx = w / 2, cy = h / 2;
      ctx.strokeStyle = 'rgba(255, 107, 53, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 8, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 20); ctx.stroke();

      // Corners
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.5)';
      ctx.lineWidth = 2;
      const bk = 15;
      [[4, 4, 1, 1], [w - 4, 4, -1, 1], [4, h - 4, 1, -1], [w - 4, h - 4, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + dy * bk); ctx.lineTo(x, y); ctx.lineTo(x + dx * bk, y); ctx.stroke();
      });

      // Timestamp
      ctx.fillStyle = 'rgba(255, 107, 53, 0.8)';
      ctx.font = '10px monospace';
      const now = new Date();
      ctx.fillText(`CAM01 ${now.toLocaleTimeString()}`, 8, h - 8);
      ctx.fillText('SIM', w - 35, 14);

      // Blinking SIM dot
      if (f % 60 < 30) {
        ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
        ctx.beginPath(); ctx.arc(w - 40, 11, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Noise
      for (let i = 0; i < 15; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [active, feedSource]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="mx-4 mb-3 rounded-2xl overflow-hidden bg-card shadow-card border border-border">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">{t('dashboard.camera.title')}</span>
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          {active && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${feedSource === 'real' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
              {feedSource === 'real' ? `LIVE ${fps}fps` : t('dashboard.camera.sim')}
            </span>
          )}
        </div>
        <button onClick={() => setActive(!active)} className="p-1 rounded-lg hover:bg-muted/50 active:bg-muted">
          {active ? <VideoOff className="w-4 h-4 text-muted-foreground" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
      <div className="relative aspect-video bg-black">
        {active ? (
          <canvas ref={canvasRef} width={320} height={180} className="w-full h-full" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground">{t('dashboard.camera.off')}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { machineState } = useRobotStore();
  const { send } = useWebSocket();
  useInteractionSync(send);

  useEffect(() => {
    if (machineState === 'RECEPTION') {
      navigate('/showcase');
    }
  }, [machineState, navigate]);

  const menuItems = [
    { icon: Gamepad2, titleKey: 'dashboard.menu.control', descKey: 'dashboard.menu.controlDesc', path: '/control', gradient: 'from-primary to-primary/80' },
    { icon: MessageCircle, titleKey: 'dashboard.menu.chat', descKey: 'dashboard.menu.chatDesc', path: '/chat', gradient: 'from-secondary to-secondary/80' },
    { icon: Map, titleKey: 'dashboard.menu.map', descKey: 'dashboard.menu.mapDesc', path: '/map', gradient: 'from-success to-success/80' },
    { icon: BarChart3, titleKey: 'dashboard.menu.telemetry', descKey: 'dashboard.menu.telemetryDesc', path: '/telemetry', gradient: 'from-warning to-warning/80' },
    { icon: Mic, titleKey: 'dashboard.menu.voice', descKey: 'dashboard.menu.voiceDesc', path: '/voice', gradient: 'from-primary to-destructive/80' },
    { icon: ShoppingBag, titleKey: 'dashboard.menu.showcase', descKey: 'dashboard.menu.showcaseDesc', path: '/showcase', gradient: 'from-success to-primary/80' },
    { icon: Stethoscope, titleKey: 'dashboard.menu.diagnostics', descKey: 'dashboard.menu.diagnosticsDesc', path: '/diagnostics', gradient: 'from-secondary to-success/80' },
    { icon: Package, titleKey: 'dashboard.menu.delivery', descKey: 'dashboard.menu.deliveryDesc', path: '/delivery', gradient: 'from-warning to-destructive/80' },
    { icon: Shield, titleKey: 'dashboard.menu.patrol', descKey: 'dashboard.menu.patrolDesc', path: '/patrol', gradient: 'from-secondary to-secondary/60' },
    { icon: Sparkles, titleKey: 'dashboard.menu.blessing', descKey: 'dashboard.menu.blessingDesc', path: '/blessing', gradient: 'from-primary to-warning/80' },
    { icon: Layers, titleKey: 'dashboard.menu.slam', descKey: 'dashboard.menu.slamDesc', path: '/slam', gradient: 'from-success to-secondary/80' },
    { icon: Search, titleKey: 'dashboard.menu.scanner', descKey: 'dashboard.menu.scannerDesc', path: '/scanner', gradient: 'from-warning to-success/80' },
    { icon: Network, titleKey: 'dashboard.menu.networkDiag', descKey: 'dashboard.menu.networkDiagDesc', path: '/network-diagnostics', gradient: 'from-primary to-cyan-500/80' },
    { icon: Radio, titleKey: 'dashboard.menu.mqtt', descKey: 'dashboard.menu.mqttDesc', path: '/mqtt', gradient: 'from-destructive to-warning/80' },
    { icon: Download, titleKey: 'dashboard.menu.ota', descKey: 'dashboard.menu.otaDesc', path: '/ota', gradient: 'from-primary to-success/80' },
    { icon: ScrollText, titleKey: 'dashboard.menu.logs', descKey: 'dashboard.menu.logsDesc', path: '/logs', gradient: 'from-muted-foreground to-secondary/60' },
    { icon: Users, titleKey: 'dashboard.menu.interactions', descKey: 'dashboard.menu.interactionsDesc', path: '/interactions', gradient: 'from-primary to-secondary/80' },
    { icon: FlaskConical, titleKey: 'dashboard.menu.deliveryTest', descKey: 'dashboard.menu.deliveryTestDesc', path: '/delivery-test', gradient: 'from-primary to-destructive/80' },
    { icon: MonitorPlay, titleKey: 'dashboard.menu.media', descKey: 'dashboard.menu.mediaDesc', path: '/media', gradient: 'from-primary to-success/80' },
    { icon: Compass, titleKey: 'dashboard.menu.rotation', descKey: 'dashboard.menu.rotationDesc', path: '/rotation', gradient: 'from-secondary to-warning/80' },
    { icon: Wrench, titleKey: 'dashboard.menu.calibration', descKey: 'dashboard.menu.calibrationDesc', path: '/calibration', gradient: 'from-warning to-secondary/80' },
    { icon: Wifi, titleKey: 'dashboard.menu.calibrationWifi', descKey: 'dashboard.menu.calibrationWifiDesc', path: '/calibration-wifi', gradient: 'from-green-500 to-primary/80' },
    { icon: Settings, titleKey: 'dashboard.menu.settings', descKey: 'dashboard.menu.settingsDesc', path: '/settings', gradient: 'from-muted-foreground to-muted-foreground/60' },
  ];

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title={t('dashboard.title')} />

      {/* Live Camera Feed */}
      <CameraFeed />

      <div className="p-4 pt-0 grid grid-cols-2 gap-3">
        {menuItems.map((item, i) => (
          <motion.button
            key={item.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(item.path)}
            className="relative overflow-hidden rounded-2xl bg-card shadow-card p-4 flex flex-col items-start gap-3 text-left active:shadow-none transition-shadow"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center`}>
              <item.icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">{t(item.titleKey)}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t(item.descKey)}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 py-6">
        <button onClick={() => navigate('/')} className="text-xs text-primary font-semibold active:opacity-70">
          {t('dashboard.backToConnection', 'Voltar à tela de conexão')}
        </button>
        <p className="text-[10px] text-muted-foreground">AlphaBot Companion v1.3.7 • Iascom</p>
      </div>
    </div>
  );
};

export default Dashboard;
