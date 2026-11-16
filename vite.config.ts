import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Backend actual (horas-sociales-core-backend). Su API vive en /api/v1, así que
  // un VITE_API_URL relativo ("/api/v1") también funciona a través de este proxy.
  const backendTarget = env.VITE_BACKEND_URL || 'http://localhost:3000';

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['leaflet'],
    },
    server: {
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
      watch: {
        ignored: ['**/dist/**', '**/backend/**'],
      },
    },
  };
});