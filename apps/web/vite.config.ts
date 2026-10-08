import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const engine = `http://127.0.0.1:${process.env.ORQ_PORT ?? '4317'}`;

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: el build se carga desde la app de escritorio, no desde la raíz de un dominio.
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    // En desarrollo la UI habla con el motor a través del proxy de Vite.
    proxy: {
      '/api': { target: engine, changeOrigin: true },
      '/ws': { target: engine, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
