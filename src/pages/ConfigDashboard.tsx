import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatusHeader from '@/components/StatusHeader';
import {
  Wrench, Radio, Network, Stethoscope, Map, BarChart3,
  ScrollText, Download, Settings, Layers, Shield, Package,
  FlaskConical, Users, MonitorPlay, Compass, Search, Wifi,
} from 'lucide-react';

interface ConfigItem {
  icon: typeof Wrench;
  title: string;
  desc: string;
  path: string;
  gradient: string;
}

const configItems: ConfigItem[] = [
  { icon: Radio, title: 'Monitor MQTT', desc: 'Mensagens e tópicos em tempo real', path: '/mqtt', gradient: 'from-destructive to-warning/80' },
  { icon: Settings, title: 'Config MQTT', desc: 'Broker, serial, portas', path: '/mqtt-config', gradient: 'from-secondary to-warning/80' },
  { icon: Wrench, title: 'Calibração', desc: 'Calibração de sensores', path: '/calibration', gradient: 'from-warning to-secondary/80' },
  { icon: Wifi, title: 'Calibração WiFi', desc: 'Painel de calibração via WiFi', path: '/calibration-wifi', gradient: 'from-success to-primary/80' },
  { icon: Network, title: 'Diagnóstico de Rede', desc: 'Teste de conectividade', path: '/network-diagnostics', gradient: 'from-primary to-secondary/80' },
  { icon: Stethoscope, title: 'Diagnósticos', desc: 'Saúde do robô', path: '/diagnostics', gradient: 'from-secondary to-success/80' },
  { icon: Map, title: 'Mapa / Nav', desc: 'SLAM e navegação', path: '/map', gradient: 'from-success to-success/80' },
  { icon: BarChart3, title: 'Telemetria', desc: 'Dados de sensores', path: '/telemetry', gradient: 'from-warning to-warning/80' },
  { icon: Layers, title: 'Mapas SLAM', desc: 'Gerenciamento de mapas', path: '/slam', gradient: 'from-success to-secondary/80' },
  { icon: Package, title: 'Delivery', desc: 'Entregas e rotas', path: '/delivery', gradient: 'from-warning to-destructive/80' },
  { icon: Shield, title: 'Patrulha', desc: 'Modo patrulha', path: '/patrol', gradient: 'from-secondary to-secondary/60' },
  { icon: Compass, title: 'Rotação Avançada', desc: 'Controle angular preciso', path: '/rotation', gradient: 'from-secondary to-warning/80' },
  { icon: Search, title: 'Scanner de Robôs', desc: 'Descobrir robôs na rede', path: '/scanner', gradient: 'from-warning to-success/80' },
  { icon: Download, title: 'Atualização OTA', desc: 'Firmware e software', path: '/ota', gradient: 'from-primary to-success/80' },
  { icon: ScrollText, title: 'Logs Avançados', desc: 'Histórico de eventos', path: '/logs', gradient: 'from-muted-foreground to-secondary/60' },
  { icon: Users, title: 'Interações', desc: 'Gerenciar interações', path: '/interactions', gradient: 'from-primary to-secondary/80' },
  { icon: FlaskConical, title: 'Teste Delivery', desc: 'Fluxo de teste', path: '/delivery-test', gradient: 'from-primary to-destructive/80' },
  { icon: MonitorPlay, title: 'Mídia', desc: 'Streaming e gravações', path: '/media', gradient: 'from-primary to-success/80' },
  { icon: Settings, title: 'Configurações', desc: 'Idioma, tema, geral', path: '/settings', gradient: 'from-muted-foreground to-muted-foreground/60' },
];

const ConfigDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background safe-bottom">
      <StatusHeader title="Configuração" />

      <div className="p-4 grid grid-cols-2 gap-3">
        {configItems.map((item, i) => (
          <motion.button
            key={item.path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(item.path)}
            className="relative overflow-hidden rounded-2xl bg-card shadow-card p-4 flex flex-col items-start gap-3 text-left active:shadow-none transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center`}>
              <item.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-foreground">{item.title}</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 py-6">
        <button onClick={() => navigate('/dashboard')} className="text-xs text-primary font-semibold active:opacity-70">
          ← Voltar ao Painel de Operação
        </button>
      </div>
    </div>
  );
};

export default ConfigDashboard;
