import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { publicPages } from "./scripts/public-pages";

export default defineConfig({
  plugins: [react(), publicPages()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
