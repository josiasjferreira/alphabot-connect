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
  videoUrl?: string;
  action?: 'open-chat';
}

export const SOLAR_PRODUCTS: SolarProduct[] = [
  {
    id: 'residential',
    nameKey: 'showcase.products.residential.name',
    descKey: 'showcase.products.residential.desc',
    icon: '☀️',
    emoji: '🔋',
    benefits: [
      'Energia limpa e sustentável',
      'Monitoramento inteligente via app',
      'Garantia de 25 anos nos painéis',
      'Instalação em até 3 dias',
      'Retorno do investimento em 3-5 anos',
    ],
    category: 'residential',
    highlight: true,
    videoUrl: '/videos/solar-life-intro.mp4',
  },
  {
    id: 'commercial',
    nameKey: 'showcase.products.commercial.name',
    descKey: 'showcase.products.commercial.desc',
    icon: '🤖',
    emoji: '⚡',
    benefits: [
      'Robótica aplicada ao presente',
      'Automação inteligente',
      'Redução de custos operacionais',
      'Integração com sistemas existentes',
      'Suporte técnico especializado',
    ],
    category: 'commercial',
  },
  {
    id: 'portable',
    nameKey: 'showcase.products.portable.name',
    descKey: 'showcase.products.portable.desc',
    icon: '🦾',
    emoji: '🌟',
    benefits: [
      'Telepresença avançada',
      'Atendimento autônomo',
      'Navegação inteligente SLAM',
      'Interação natural por voz',
      'Integração com sistemas de gestão',
    ],
    category: 'portable',
  },
  {
    id: 'irrigation',
    nameKey: 'showcase.products.irrigation.name',
    descKey: 'showcase.products.irrigation.desc',
    icon: '💼',
    emoji: '📊',
    benefits: [
      'Consultoria em automação',
      'Projetos sob medida',
      'Suporte contínuo',
      'Treinamento de equipes',
      'Transformação digital completa',
    ],
    category: 'agriculture',
  },
  {
    id: 'lighting',
    nameKey: 'showcase.products.lighting.name',
    descKey: 'showcase.products.lighting.desc',
    icon: '💬',
    emoji: '🤖',
    benefits: [
      'Assistente inteligente 24/7',
      'Cadastro rápido e fácil',
      'Informações personalizadas',
      'Atendimento por Chat IA',
      'Contato direto com especialistas',
    ],
    category: 'lighting',
    action: 'open-chat',
  },
];
