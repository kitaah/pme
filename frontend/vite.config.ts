import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// En developpement local, le front appelle les services lances sur la machine
// (voir `make dev-api`). En cluster, c'est l'ingress qui route /api.
// Le front n'appelle pas le service de moderation : c'est un composant de back-office,
// interroge par scripts/smoke.sh et par `make db-moderation`.
export default defineConfig({
  // tailwindcss() compile src/styles.css : aucun fichier tailwind.config.js, le theme est dans la feuille
  plugins: [react(), tailwindcss()],
  // Alias « @/ » = src/ (déclaré aussi dans tsconfig.json), utilisé par les composants shadcn/ui
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', '**/*.test.*'],
      thresholds: { lines: 50, branches: 35 },
    },
  },
});
