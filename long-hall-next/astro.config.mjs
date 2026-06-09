// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath, URL } from 'node:url';

import preact from '@astrojs/preact';

import tailwindcss from '@tailwindcss/vite';

const isProduction = process.env.NODE_ENV === 'production';

// https://astro.build/config
export default defineConfig({
  integrations: [preact({ compat: true })],

  // Inline small stylesheets for reduced HTTP requests
  build: {
    inlineStylesheets: 'auto',
  },

  vite: {
    plugins: [tailwindcss()],
    
    // Path aliases matching tsconfig.json
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
        '@islands': fileURLToPath(new URL('./src/islands', import.meta.url)),
        '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
        '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
        '@art': fileURLToPath(new URL('./src/art', import.meta.url)),
        '@config': fileURLToPath(new URL('./src/config', import.meta.url)),
        '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
        '@state': fileURLToPath(new URL('./src/state', import.meta.url)),
      },
    },
    
    build: {
      // Enable minification and tree-shaking
      minify: 'esbuild',
      
      // Target modern browsers for smaller bundles
      target: 'esnext',
      
      // Generate source maps for production debugging
      sourcemap: false,
      
      rollupOptions: {
        output: {
          // Manual chunk splitting for optimal caching
          manualChunks: (id) => {
            // Vendor chunk for Preact and signals
            if (id.includes('node_modules/preact') || 
                id.includes('node_modules/@preact/signals')) {
              return 'vendor-preact';
            }
            
            // GSAP in its own chunk (tree-shakeable)
            if (id.includes('node_modules/gsap')) {
              return 'vendor-gsap';
            }
            
            // Zod validation library
            if (id.includes('node_modules/zod')) {
              return 'vendor-zod';
            }
            
            // Game engine modules grouped together
            if (id.includes('/src/engine/')) {
              return 'game-engine';
            }
            
            // State management
            if (id.includes('/src/state/')) {
              return 'game-state';
            }
            
            // Animation utilities
            if (id.includes('/src/lib/animations/')) {
              return 'animations';
            }
          },
          
          // Optimize chunk file naming for caching
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      
      // Chunk size warnings
      chunkSizeWarningLimit: 500,
    },
    
    // Optimize dependencies
    optimizeDeps: {
      // Pre-bundle these dependencies for faster dev startup
      include: ['preact', '@preact/signals', 'gsap', 'zod'],
      
      // Exclude server-only dependencies
      exclude: [],
    },
    
    // Enable CSS code splitting
    css: {
      devSourcemap: true,
    },
    
    // esbuild options for faster builds
    esbuild: {
      // Remove console.log and debugger statements in production
      drop: isProduction ? ['console', 'debugger'] : [],
      // Minify identifiers in production for smaller output
      minifyIdentifiers: isProduction,
      minifySyntax: isProduction,
      minifyWhitespace: isProduction,
    },
  },
  
  // Prefetch linked pages for faster navigation
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  
  // Compress HTML output
  compressHTML: true,
});
