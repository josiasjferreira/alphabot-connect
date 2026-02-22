import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { useSettingsStore } from "./store/useSettingsStore";

// Apply dark mode from persisted settings on load
const darkMode = useSettingsStore.getState().darkMode;
if (darkMode) document.documentElement.classList.add('dark');

// ─── Migração MQTT: corrigir IPs antigos no localStorage ───
try {
  const raw = localStorage.getItem('mqtt-config-storage');
  if (raw) {
    const parsed = JSON.parse(raw);
    const state = parsed?.state;
    if (state) {
      let dirty = false;
      // Corrigir broker ativo com IP legado .101
      if (typeof state.activeBroker === 'string' && state.activeBroker.includes('192.168.99.101')) {
        state.activeBroker = 'ws://192.168.99.197:9001';
        dirty = true;
      }
      // Corrigir porta 1883 em URLs ws:// (navegadores precisam de 9001)
      if (typeof state.activeBroker === 'string' && state.activeBroker.includes(':1883')) {
        state.activeBroker = state.activeBroker.replace(':1883', ':9001');
        dirty = true;
      }
      if (state.wsPort === 1883) {
        state.wsPort = 9001;
        dirty = true;
      }
      if (dirty) {
        parsed.state = state;
        localStorage.setItem('mqtt-config-storage', JSON.stringify(parsed));
        console.log('🔧 MQTT config migrada: IP/porta corrigidos no localStorage');
      }
    }
  }
} catch { /* ignore */ }

// Global error handler - dev shows details, prod shows generic message
window.onerror = (msg, source, line, col, error) => {
  if (import.meta.env.DEV) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:red;color:white;padding:16px;font-size:14px;word-break:break-all;max-height:50vh;overflow:auto';
    errorDiv.innerHTML = `<b>ERRO:</b> ${msg}<br><b>Arquivo:</b> ${source}<br><b>Linha:</b> ${line}:${col}<br><b>Stack:</b> ${error?.stack || 'N/A'}`;
    document.body.appendChild(errorDiv);
  } else {
    console.error('Application error:', msg);
  }
};

window.addEventListener('unhandledrejection', (e) => {
  if (import.meta.env.DEV) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:orange;color:black;padding:16px;font-size:14px;word-break:break-all';
    errorDiv.innerHTML = `<b>Promise Rejeitada:</b> ${e.reason?.message || e.reason || 'Erro desconhecido'}<br><b>Stack:</b> ${e.reason?.stack || 'N/A'}`;
    document.body.appendChild(errorDiv);
  } else {
    console.error('Unhandled rejection:', e.reason);
  }
});

// Eruda DevTools - only available in development builds
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  script.onload = () => (window as any).eruda?.init();
  document.body.appendChild(script);
}

createRoot(document.getElementById("root")!).render(<App />);
