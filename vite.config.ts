import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/mnehmos.long-hall.game/', // Base path for GitHub Pages
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
      },
    },
  }
});
