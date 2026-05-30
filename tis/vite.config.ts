import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Enables HTTPS with a self-signed certificate.
      // Chrome's Web Speech API requires HTTPS — without it the mic shows
      // "network error" because Chrome blocks speech on insecure origins.
      // On first load, click "Advanced → Proceed to localhost" to accept the cert.
      basicSsl(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      https: true as any,
      port: 5173,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/timesheet': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
