import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/(?!\api)/],
      },
      manifest: {
        name: 'AlphaBot Connect',
        short_name: 'AlphaBot',
        description: 'Interface de controle do robô AlphaBot CT300-H13307',
        theme_color: '#0ea5e9',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      disable: mode === 'production', // Desabilitar PWA no build nativo
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'es2015', // Compatibilidade com WebView Android antigo
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Manter console.log para debug
      },
    },
    rollupOptions: {
      output: {
        manualChunks: undefined, // Evitar code splitting complexo
      },
    },
  },
}));
