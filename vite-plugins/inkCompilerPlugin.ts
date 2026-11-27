import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { Compiler, CompilerOptions, JsonFileHandler } from 'inkjs/full';

function compileInkFileSync(inkPath: string): { outPath: string; warnings: string[] } {
  const source = fs.readFileSync(inkPath, 'utf8');
  const filename = path.basename(inkPath);
  const errors: string[] = [];
  const warnings: string[] = [];

  const options = new CompilerOptions(
    filename,
    [],
    false,
    (message, errorType) => {
      if (errorType === 2) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    },
    new JsonFileHandler({ [filename]: source })
  );

  const compiler = new Compiler(source, options);
  let story = null;
  let compileException: unknown = null;
  try {
    story = compiler.Compile();
  } catch (err) {
    compileException = err;
  }
  const allErrors = [...errors, ...(compiler.errors ?? [])];
  const allWarnings = [...warnings, ...(compiler.warnings ?? [])];

  if (!story || allErrors.length > 0) {
    const fallback =
      compileException instanceof Error
        ? compileException.message
        : `Unknown Ink error in ${inkPath}`;
    throw new Error(allErrors.join('\n') || fallback);
  }

  const outPath = inkPath.replace(/\.ink$/i, '.json');
  const json = story.ToJson();
  if (!json) {
    throw new Error(`Empty JSON generated for ${inkPath}`);
  }
  fs.writeFileSync(outPath, json, 'utf8');
  return { outPath, warnings: allWarnings };
}

function compileAllUnder(scenariosDir: string, log: (msg: string) => void): void {
  if (!fs.existsSync(scenariosDir)) return;
  const entries = fs.readdirSync(scenariosDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(scenariosDir, entry.name);
    for (const file of fs.readdirSync(dirPath)) {
      if (file.toLowerCase().endsWith('.ink')) {
        const inkPath = path.join(dirPath, file);
        const { outPath, warnings } = compileInkFileSync(inkPath);
        log(`[ink-plugin] compiled ${path.relative(process.cwd(), inkPath)} -> ${path.relative(process.cwd(), outPath)}`);
        for (const w of warnings) {
          console.warn(`[ink-plugin] warning: ${w}`);
        }
      }
    }
  }
}

export function inkCompilerPlugin(): Plugin {
  const scenariosDir = path.resolve(process.cwd(), 'public', 'scenarios');

  return {
    name: 'curu-os-ink-compiler',
    buildStart() {
      compileAllUnder(scenariosDir, (msg) => console.log(msg));
    },
    configureServer(server: ViteDevServer) {
      try {
        compileAllUnder(scenariosDir, (msg) => server.config.logger.info(msg));
      } catch (err) {
        server.config.logger.error(
          `[ink-plugin] ${err instanceof Error ? err.message : String(err)}`
        );
      }

      const handleInkChange = (changedFile: string) => {
        const normalized = path.resolve(changedFile);
        if (!normalized.startsWith(scenariosDir) || !normalized.toLowerCase().endsWith('.ink')) {
          return;
        }
        try {
          const { outPath, warnings } = compileInkFileSync(normalized);
          server.config.logger.info(
            `[ink-plugin] recompiled ${path.relative(process.cwd(), normalized)} -> ${path.relative(process.cwd(), outPath)}`
          );
          for (const w of warnings) {
            server.config.logger.warn(`[ink-plugin] warning: ${w}`);
          }
          server.ws.send({ type: 'full-reload' });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          server.config.logger.error(`[ink-plugin] compile error:\n${message}`);
          server.ws.send({
            type: 'error',
            err: { message, stack: '' },
          });
        }
      };

      server.watcher.on('add', handleInkChange);
      server.watcher.on('change', handleInkChange);
    },
  };
}
