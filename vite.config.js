import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { preserveSymlinks: true },
  server: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/ldraw-library': {
        target: 'https://library.ldraw.org',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/ldraw-library\//, '/library/'),
      },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});

