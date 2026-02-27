/**
 * src/config/mqtt.ts
 * Configuração MQTT centralizada — AlphaBot Connect v2.0
 * Arquitetura PC-Centric (3 dispositivos)
 * 
 * NÃO modificar sem atualizar documentação técnica.
 * 
 * IMPORTANTE: Porta 9001 está BLOQUEADA pelo Windows (HTTP.SYS, PID 4).
 * Usar SEMPRE porta 9002 para WebSocket MQTT.
 */

export const NETWORK_CONFIG = {
  /** PC (Broker MQTT + Servidor Web) — IP ESTÁTICO */
  PC_IP: '192.168.99.100',

  /** Placa Android — CÉREBRO DO ROBÔ (SO Android, apps internos, multimídia) — NÓ CRÍTICO */
  ANDROID_BOARD_IP: '192.168.99.10',

  /** SLAMWARE — Navegação / mapeamento */
  SLAM_IP: '192.168.99.2',

  /** Tablet (display secundário via browser / app Lovable) — IP ESTÁTICO */
  TABLET_IP: '192.168.99.200',

  /** Panda Router — Gateway Wi-Fi da rede do robô */
  GATEWAY_IP: '192.168.99.1',

  /** AlphaBot firmware (APK antigo — DESCONSIDERADO no momento) */
  ROBOT_FIRMWARE_IP: '192.168.99.101',

  /** Subrede */
  SUBNET: '192.168.99',
} as const;

export const MQTT_CONFIG = {
  /** Broker IP: sempre o PC */
  BROKER_IP: NETWORK_CONFIG.PC_IP,

  /** Porta TCP (dispositivos embarcados / robô) */
  MQTT_PORT: 1883,

  /** Porta WebSocket (browsers / apps web) — SEMPRE 9002 */
  WEBSOCKET_PORT: 9002,

  /** URL WebSocket completa */
  WEBSOCKET_URL: `ws://${NETWORK_CONFIG.PC_IP}:9002`,

  /** Serial do robô */
  ROBOT_SERIAL: 'H13307',

  /** Tópicos MQTT */
  TOPICS: {
    CONTROL: `alphabot/H13307/control`,
    TELEMETRY: `alphabot/H13307/telemetry`,
    STATUS: `alphabot/H13307/status`,
    SENSORS: `alphabot/H13307/sensors`,
    HEARTBEAT: `alphabot/H13307/heartbeat`,

    // ─── Áudio (Guia de Integração v3.0) ───
    AUDIO_TTS: 'alphabot/audio/tts',
    AUDIO_BEEP: 'alphabot/audio/beep',
    AUDIO_ALERT: 'alphabot/audio/alert',
    AUDIO_VOLUME: 'alphabot/audio/volume',
    AUDIO_STATUS: 'alphabot/audio/status',
  },

  /** Timeouts */
  CONNECT_TIMEOUT: 5000,
  RECONNECT_INTERVAL: 3000,
  KEEPALIVE: 60,
} as const;

/** Validação em runtime */
export function validateMQTTConfig(): boolean {
  const required = [MQTT_CONFIG.BROKER_IP, MQTT_CONFIG.WEBSOCKET_URL];
  return required.every(v => v && v.length > 0);
}

/** IPs legados que devem ser migrados para o novo PC_IP */
export const LEGACY_IPS = ['192.168.99.197', '192.168.99.103', '192.168.99.102'] as const;

/** Portas legadas que devem ser migradas para 9002 */
export const LEGACY_PORTS = [9001] as const;
