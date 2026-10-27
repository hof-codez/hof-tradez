import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the same build works on GitHub Pages (/repo-name/) and inside the Android app.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
});
