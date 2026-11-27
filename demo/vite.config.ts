import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Second site, indépendant : « Le champ virtuel » (démonstration grand public).
 * Racine = demo/, donc les dépendances sont résolues depuis le node_modules
 * du dépôt et le build sort dans dist-demo/ (dossier publié par Vercel).
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // three.js change rarement : le sortir du bundle applicatif permet au
        // navigateur de le garder en cache d'un déploiement à l'autre.
        manualChunks(id) {
          return id.includes('node_modules/three') ? 'three' : undefined;
        },
      },
    },
  },
});
