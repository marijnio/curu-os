import type { Plugin } from 'vite';

export function curuScenariosPlugin(options: {
  scenariosDir: string;
  isExternal?: boolean;
}): Plugin;
