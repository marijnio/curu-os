import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { inkCompilerPlugin } from './vite-plugins/inkCompilerPlugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), inkCompilerPlugin()],
  build: {
    target: 'es2022',
  },
});
