/**
 * SolarProductData — Dados dos produtos Solar Life para o showcase de feira.
 */

export interface SolarProduct {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  emoji: string;
  benefits: string[];
  category: 'residential' | 'commercial' | 'portable' | 'agriculture' | 'lighting';
  highlight?: boolean;
}

export const SOLAR_PRODUCTS: SolarProduct[] = [
  {
    id: 'residential',
    nameKey: 'showcase.products.residential.name',
    descKey: 'showcase.products.residential.desc',
    icon: '🏠',
    emoji: '☀️',
    benefits: [
      'Economia de até 95% na conta de luz',
      'Monitoramento inteligente via app',
      'Garantia de 25 anos nos painéis',
      'Instalação em até 3 dias',
      'Retorno do investimento em 3-5 anos',
    ],
    category: 'residential',
    highlight: true,
  },
  {
    id: 'commercial',
    nameKey: 'showcase.products.commercial.name',
    descKey: 'showcase.products.commercial.desc',
    icon: '🏢',
    emoji: '⚡',
    benefits: [
      'Projetos customizados de grande porte',
      'ROI em até 4 anos',
      'Redução de pegada de carbono',
      'Manutenção preventiva incluída',
      'Financiamento facilitado',
    ],
    category: 'commercial',
  },
  {
    id: 'portable',
    nameKey: 'showcase.products.portable.name',
    descKey: 'showcase.products.portable.desc',
    icon: '🔋',
    emoji: '🔌',
    benefits: [
      'Bateria de lítio de longa duração',
      'Múltiplas saídas USB e AC',
      'Ideal para camping e emergências',
      'Carregamento solar direto',
      'Leve e transportável',
    ],
    category: 'portable',
  },
  {
    id: 'irrigation',
    nameKey: 'showcase.products.irrigation.name',
    descKey: 'showcase.products.irrigation.desc',
    icon: '🌱',
    emoji: '💧',
    benefits: [
      'Sistema 100% autônomo',
      'Sem necessidade de rede elétrica',
      'Ideal para áreas remotas',
      'Bombeamento contínuo e eficiente',
      'Redução de custos operacionais',
    ],
    category: 'agriculture',
  },
  {
    id: 'lighting',
    nameKey: 'showcase.products.lighting.name',
    descKey: 'showcase.products.lighting.desc',
    icon: '💡',
    emoji: '🌙',
    benefits: [
      'LED de alta eficiência',
      'Sensor crepuscular automático',
      'Zero custo de energia',
      'Instalação sem fiação',
      'Até 12h de autonomia',
    ],
    category: 'lighting',
  },
  {
    id: 'monitoring',
    nameKey: 'showcase.products.monitoring.name',
    descKey: 'showcase.products.monitoring.desc',
    icon: '📊',
    emoji: '📱',
    benefits: [
      'Monitoramento em tempo real',
      'Alertas de performance',
      'Relatórios de economia',
      'Integração com inversores',
      'App para iOS e Android',
    ],
    category: 'residential',
  },
];
