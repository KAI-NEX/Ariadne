import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Import the selected media explicitly; retain unshipped studies in place.
  publicDir: false,
  // Retain older generated assets, in line with the project's artifact policy.
  build: { emptyOutDir: false },
  server: { port: 5173, strictPort: true },
});
