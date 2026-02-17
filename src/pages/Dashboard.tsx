import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, MessageCircle, Map, BarChart3, Mic, Settings, ShoppingBag, Stethoscope, Package, Shield, Sparkles, Layers, Radio, Download, ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusHeader from '@/components/StatusHeader';
import { useRobotStore } from '@/store/useRobotStore';

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { machineState } = useRobotStore();

  // Auto-navigate to showcase when robot enters RECEPTION state
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

      <div className="p-4 grid grid-cols-2 gap-3">
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
