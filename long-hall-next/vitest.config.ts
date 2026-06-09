import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts,tsx}'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/engine/**', 'src/lib/**']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@islands': resolve(__dirname, './src/islands'),
      '@engine': resolve(__dirname, './src/engine'),
      '@lib': resolve(__dirname, './src/lib'),
      '@art': resolve(__dirname, './src/art'),
      '@config': resolve(__dirname, './src/config'),
      '@content': resolve(__dirname, './src/content'),
      '@state': resolve(__dirname, './src/state')
    }
  }
});
