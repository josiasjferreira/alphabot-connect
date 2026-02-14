import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, MessageCircle, Map, BarChart3, Mic, Settings } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';

const menuItems = [
  { icon: Gamepad2, title: 'Controle Manual', desc: 'Joystick e comandos', path: '/control', gradient: 'from-primary to-primary/80' },
  { icon: MessageCircle, title: 'Chat IA', desc: 'Converse com o robô', path: '/chat', gradient: 'from-secondary to-secondary/80' },
  { icon: Map, title: 'Mapa', desc: 'Navegação e rotas', path: '/map', gradient: 'from-success to-success/80' },
  { icon: BarChart3, title: 'Telemetria', desc: 'Status e sensores', path: '/telemetry', gradient: 'from-warning to-warning/80' },
  { icon: Mic, title: 'Comandos de Voz', desc: 'Controle por voz', path: '/voice', gradient: 'from-primary to-destructive/80' },
  { icon: Settings, title: 'Configurações', desc: 'Ajustes avançados', path: '/settings', gradient: 'from-muted-foreground to-muted-foreground/60' },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title="AlphaBot Dashboard" showBack={false} />

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
              <h3 className="font-bold text-sm text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
