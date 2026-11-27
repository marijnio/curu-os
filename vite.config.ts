import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { curuScenariosPlugin } from './scripts/scenarios-plugin.mjs';

const externalScenariosEnv = process.env.CURU_SCENARIOS_DIR;
const isExternal = Boolean(externalScenariosEnv);
const scenariosDir = externalScenariosEnv
  ? path.resolve(externalScenariosEnv)
  : path.resolve(process.cwd(), 'public', 'scenarios');

export default defineConfig({
  publicDir: isExternal ? false : 'public',
  plugins: [
    react(),
    tailwindcss(),
    curuScenariosPlugin({ scenariosDir, isExternal }),
  ],
  build: {
    target: 'es2022',
  },
});
