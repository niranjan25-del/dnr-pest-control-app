// vite.config.ts
// Vite + React. `@` aliases to /src for clean imports. Env vars must be prefixed VITE_.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  preview: { port: 4173 },
  build: { outDir: 'dist', sourcemap: true },
});
