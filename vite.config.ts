import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'IronLog – Strength & Hypertrophy',
        short_name: 'IronLog',
        description: 'Personal strength & hypertrophy training system with progressive overload coaching',
        theme_color: '#15171C',
        background_color: '#15171C',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] }
    })
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
})
