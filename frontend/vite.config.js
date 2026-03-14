import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo192.png'],

      manifest: {
        name: 'BarOS V4',
        short_name: 'BarOS',
        description: 'Interface de commande cocktails',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/queue',
        icons: [
          { src: '/logo192.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/api/],
      },

      injectManifest: false,

      devOptions: {
        enabled: true,
      },
    }),
  ],
  // 🆕 AJOUTE CE BLOC ICI POUR OUVRIR LE RÉSEAU
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})