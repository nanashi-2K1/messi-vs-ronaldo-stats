/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    // three.js (≈ 560 kB) est isolé dans le fichier « arcade », chargé après le premier affichage.
    chunkSizeWarningLimit: 650,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
