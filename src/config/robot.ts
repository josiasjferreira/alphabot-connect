// src/config/robot.ts
export const ROBOT_CONFIG = {
  // IP padrão do robô (usuário pode mudar no app)
  defaultIP: '192.168.39.2',
  defaultPort: 8080,
  websocketPath: '/ws',
  
  // Construir URL completa
  getWebSocketURL: (ip?: string, port?: number) => {
    const robotIP = ip || ROBOT_CONFIG.defaultIP;
    const robotPort = port || ROBOT_CONFIG.defaultPort;
    return `ws://${robotIP}:${robotPort}${ROBOT_CONFIG.websocketPath}`;
  },
};
