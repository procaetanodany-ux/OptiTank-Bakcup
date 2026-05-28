import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        navigateFallbackDenylist: [/^\/admin/],
      },
      manifest: {
        name: 'OptiTank Pro',
        short_name: 'OptiTank',
        description: 'Comparateur intelligent de prix des carburants TCS',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        shortcuts: [
          {
            name: "Lancer le Radar IA",
            short_name: "Radar IA",
            description: "Analyse les stations autour de vous",
            url: "/?view=radar",
            icons: [{ src: "icon-192.png", sizes: "192x192" }]
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api/tcs': {
        target: 'https://firestore.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tcs/, ''),
        headers: { 'Referer': 'https://benzin.tcs.ch/', 'Origin': 'https://benzin.tcs.ch' }
      },
      '/api/benzin': {
        target: 'https://europe-west6-tcs-digitalbackend.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/benzin/, ''),
        headers: { 'Referer': 'https://benzin.tcs.ch/', 'Origin': 'https://benzin.tcs.ch' }
      }
    }
  },
  build: {
    rollupOptions: {
      external: [
        'fsevents'
      ],
    },
  }
});
