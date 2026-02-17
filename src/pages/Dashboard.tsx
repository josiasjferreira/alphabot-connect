import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, MessageCircle, Map, BarChart3, Mic, Settings, ShoppingBag, Stethoscope, Package, Shield, Sparkles, Layers, Radio, Download, ScrollText, Camera, VideoOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { useRobotStore } from '@/store/useRobotStore';

const CameraFeed = () => {
  const { t } = useTranslation();
  const { ip, connectionStatus, offlineMode } = useRobotStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(true);
  const frameRef = useRef<number>(0);

  // Simulated camera feed with moving visual
  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      frameRef.current += 1;
      const f = frameRef.current;

      // Dark background with grid
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(0, 0, w, h);

      // Grid overlay
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // Simulated room environment shapes
      ctx.fillStyle = 'rgba(0, 78, 137, 0.08)';
      ctx.fillRect(20, 30, 80, 60);
      ctx.fillRect(w - 100, 20, 80, 50);
      ctx.fillRect(40, h - 70, 120, 40);

      // Moving scan line
      const scanY = (f * 2) % h;
      const gradient = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
      gradient.addColorStop(0, 'rgba(255, 107, 53, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 107, 53, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 107, 53, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, scanY - 10, w, 20);

      // Center crosshair
      const cx = w / 2, cy = h / 2;
      ctx.strokeStyle = 'rgba(255, 107, 53, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 8, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 20); ctx.stroke();

      // Corner brackets
      ctx.strokeStyle = 'rgba(0, 78, 137, 0.5)';
      ctx.lineWidth = 2;
      const bk = 15;
      [[4, 4, 1, 1], [w - 4, 4, -1, 1], [4, h - 4, 1, -1], [w - 4, h - 4, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + dy * bk); ctx.lineTo(x, y); ctx.lineTo(x + dx * bk, y); ctx.stroke();
      });

      // Timestamp overlay
      ctx.fillStyle = 'rgba(255, 107, 53, 0.8)';
      ctx.font = '10px monospace';
      const now = new Date();
      ctx.fillText(`CAM01 ${now.toLocaleTimeString()}`, 8, h - 8);
      ctx.fillText(`REC ●`, w - 45, 14);

      // Blinking REC dot
      if (f % 60 < 30) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
        ctx.beginPath(); ctx.arc(w - 48, 11, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Noise dots
      for (let i = 0; i < 15; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [active]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="mx-4 mb-3 rounded-2xl overflow-hidden bg-card shadow-card border border-border">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">{t('dashboard.camera.title')}</span>
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
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
    { icon: Radio, titleKey: 'dashboard.menu.mqtt', descKey: 'dashboard.menu.mqttDesc', path: '/mqtt', gradient: 'from-destructive to-warning/80' },
    { icon: Download, titleKey: 'dashboard.menu.ota', descKey: 'dashboard.menu.otaDesc', path: '/ota', gradient: 'from-primary to-success/80' },
    { icon: ScrollText, titleKey: 'dashboard.menu.logs', descKey: 'dashboard.menu.logsDesc', path: '/logs', gradient: 'from-muted-foreground to-secondary/60' },
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
    </div>
  );
};

export default Dashboard;
