/**
 * Migração de configurações MQTT legadas para v2.0
 * Executar UMA VEZ na inicialização do app.
 */

import { MQTT_CONFIG, NETWORK_CONFIG } from '@/config/mqtt';

export function migrateLegacyConfig(): void {
  console.log('[Migration] Verificando configurações MQTT legadas...');

  // Migrar mqtt-config-storage (zustand persist)
  try {
    const raw = localStorage.getItem('mqtt-config-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = parsed?.state;
      if (state) {
        let dirty = false;

        // Corrigir IPs antigos → novo IP do PC
        const legacyIps = ['192.168.99.101', '192.168.99.197', '192.168.99.103', '192.168.99.200'];
        if (typeof state.activeBroker === 'string') {
          for (const oldIp of legacyIps) {
            if (state.activeBroker.includes(oldIp)) {
              state.activeBroker = state.activeBroker.replace(oldIp, NETWORK_CONFIG.PC_IP);
              dirty = true;
            }
          }
          // Corrigir porta 9001 → 9002
          if (state.activeBroker.includes(':9001')) {
            state.activeBroker = state.activeBroker.replace(':9001', ':9002');
            dirty = true;
          }
          // Corrigir porta 1883 em URLs ws://
          if (state.activeBroker.includes('ws://') && state.activeBroker.includes(':1883')) {
            state.activeBroker = state.activeBroker.replace(':1883', ':9002');
            dirty = true;
          }
        }

        if (state.wsPort === 9001 || state.wsPort === 1883) {
          state.wsPort = MQTT_CONFIG.WEBSOCKET_PORT;
          dirty = true;
        }

        // Migrar broker candidates
        if (Array.isArray(state.brokerCandidates)) {
          state.brokerCandidates = state.brokerCandidates.map((url: string) => {
            let u = url;
            for (const oldIp of legacyIps) {
              u = u.replace(oldIp, NETWORK_CONFIG.PC_IP);
            }
            u = u.replace(':9001', ':9002');
            return u;
          });
          dirty = true;
        }

        if (dirty) {
          parsed.state = state;
          localStorage.setItem('mqtt-config-storage', JSON.stringify(parsed));
          console.log('[Migration] ✅ mqtt-config-storage migrado para v2.0');
        }
      }
    }
  } catch { /* ignore */ }

  // Forçar valores corretos em chaves avulsas (se existirem)
  const keysToCheck = ['mqtt_ip', 'broker_ip', 'mqtt_port', 'ws_port', 'websocket_port', 'mqtt_url'];
  const legacyMappings: Record<string, string> = {
    '192.168.99.101': NETWORK_CONFIG.PC_IP,
    '192.168.99.197': NETWORK_CONFIG.PC_IP,
    '192.168.99.103': NETWORK_CONFIG.PC_IP,
    '9001': '9002',
  };

  keysToCheck.forEach(key => {
    const value = localStorage.getItem(key);
    if (value && legacyMappings[value]) {
      console.log(`[Migration] ${key}: ${value} → ${legacyMappings[value]}`);
      localStorage.setItem(key, legacyMappings[value]);
    }
  });

  console.log('[Migration] Config MQTT verificada para v2.0');
}
