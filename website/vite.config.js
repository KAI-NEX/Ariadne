import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Retain older generated assets, in line with the project's artifact policy.
  build: { emptyOutDir: false },
  server: { port: 5173, strictPort: true },
});
