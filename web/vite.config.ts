import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const repo = new URL('../', import.meta.url);

export default defineConfig({
  root: fileURLToPath(new URL('web/', repo)),
  publicDir: false,
  plugins: [
    react(), tailwindcss(),
    {
      name: 'kfc-chat-download-page',
      async generateBundle() {
        for (const [source, fileName] of [['index.html', 'download.html'], ['style.css', 'style.css'], ['icon.png', 'icon.png']]) {
          this.emitFile({ type: 'asset', fileName, source: await readFile(new URL('public/' + source, repo)) });
        }
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(repo) } },
  build: {
    outDir: fileURLToPath(new URL('web-build/', repo)),
    emptyOutDir: true,
    commonjsOptions: { include: [/node_modules/, /electron[\\/]api\.cjs$/] },
  },
});
