import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solarlife.alphabot',
  appName: 'AlphaBot Connect',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ['*'],
  },
  android: {
    minWebViewVersion: 60,
    allowMixedContent: true,
    webContentsDebuggingEnabled: false, // Desligar debug em produção
    backgroundColor: '#1a1a1a',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false,
    },
  },
};

export default config;
