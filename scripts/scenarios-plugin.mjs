import fs from 'node:fs';
import path from 'node:path';
import {
  compileAllScenarios,
  compileInkFile,
  resolveScenarioEntrypoints,
} from './compile-ink.mjs';
import { createAuthHandler } from '../server/auth.mjs';

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.ink': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function findScenarioSubdir(filePath, scenariosDir) {
  const rel = path.relative(scenariosDir, filePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const firstSegment = rel.split(path.sep)[0];
  if (!firstSegment) return null;
  const candidate = path.join(scenariosDir, firstSegment);
  return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

function logCompileResults(results, logger) {
  for (const item of results) {
    logger.info(
      `[curu-scenarios] compiled ${path.relative(process.cwd(), item.inkPath)} -> ${path.relative(process.cwd(), item.outPath)}`
    );
    for (const warn of item.warnings) {
      logger.warn(`[curu-scenarios] warning: ${warn}`);
    }
  }
}

export function curuScenariosPlugin({ scenariosDir, isExternal = false }) {
  const resolvedScenariosDir = path.resolve(scenariosDir);
  let resolvedOutDir = path.resolve(process.cwd(), 'dist');

  return {
    name: 'curu-os-scenarios',
    configResolved(config) {
      const outDir = config.build?.outDir || 'dist';
      resolvedOutDir = path.isAbsolute(outDir)
        ? outDir
        : path.resolve(config.root, outDir);
    },
    buildStart() {
      const compiled = compileAllScenarios(resolvedScenariosDir);
      logCompileResults(compiled, {
        info: (msg) => console.log(msg),
        warn: (msg) => console.warn(msg),
      });
    },
    configureServer(server) {
      const auth = createAuthHandler(process.env);
      server.middlewares.use((req, res, next) => {
        void auth.handleAuthMiddleware(req, res, next);
      });

      try {
        const compiled = compileAllScenarios(resolvedScenariosDir);
        logCompileResults(compiled, {
          info: (msg) => server.config.logger.info(msg),
          warn: (msg) => server.config.logger.warn(msg),
        });
      } catch (err) {
        server.config.logger.error(
          `[curu-scenarios] ${err instanceof Error ? err.message : String(err)}`
        );
      }

      if (isExternal) {
        server.middlewares.use('/scenarios', (req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            next();
            return;
          }

          const rawUrl = (req.url || '/').split('?')[0];
          let decodedPath;
          try {
            decodedPath = decodeURIComponent(rawUrl);
          } catch {
            res.statusCode = 400;
            res.end('Bad Request');
            return;
          }

          const relPath = decodedPath.replace(/^\/+/, '');
          const targetPath = path.resolve(resolvedScenariosDir, relPath);

          if (
            targetPath !== resolvedScenariosDir &&
            !targetPath.startsWith(resolvedScenariosDir + path.sep)
          ) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }

          if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
          }

          const ext = path.extname(targetPath).toLowerCase();
          res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

          if (req.method === 'HEAD') {
            res.statusCode = 200;
            res.end();
            return;
          }

          fs.createReadStream(targetPath).pipe(res);
        });
      }

      if (fs.existsSync(resolvedScenariosDir)) {
        server.watcher.add(resolvedScenariosDir);
      }

      const handleScenarioChange = (changedFile) => {
        const normalized = path.resolve(changedFile);
        if (
          normalized !== resolvedScenariosDir &&
          !normalized.startsWith(resolvedScenariosDir + path.sep)
        ) {
          return;
        }

        const lower = normalized.toLowerCase();

        // Ignore compiled story.json writes when a sibling .ink exists to avoid double reload
        if (lower.endsWith('.json')) {
          const siblingInk = normalized.replace(/\.json$/i, '.ink');
          if (fs.existsSync(siblingInk)) {
            return;
          }
        }

        if (lower.endsWith('.ink')) {
          try {
            const scenarioDir = findScenarioSubdir(normalized, resolvedScenariosDir);
            const targets = scenarioDir ? resolveScenarioEntrypoints(scenarioDir) : [normalized];
            const toCompile = targets.length > 0 ? targets : [normalized];
            for (const target of toCompile) {
              const { outPath, warnings } = compileInkFile(
                target,
                scenarioDir || path.dirname(target)
              );
              server.config.logger.info(
                `[curu-scenarios] recompiled ${path.relative(process.cwd(), target)} -> ${path.relative(process.cwd(), outPath)}`
              );
              for (const w of warnings) {
                server.config.logger.warn(`[curu-scenarios] warning: ${w}`);
              }
            }
            server.ws.send({ type: 'full-reload' });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            server.config.logger.error(`[curu-scenarios] compile error:\n${message}`);
            server.ws.send({
              type: 'error',
              err: { message, stack: '' },
            });
          }
          return;
        }

        // Reload on scenario.json, index.json, markdown docs, or media changes
        server.ws.send({ type: 'full-reload' });
      };

      server.watcher.on('add', handleScenarioChange);
      server.watcher.on('change', handleScenarioChange);
      server.watcher.on('unlink', handleScenarioChange);
    },
    configurePreviewServer(server) {
      const auth = createAuthHandler(process.env);
      server.middlewares.use((req, res, next) => {
        void auth.handleAuthMiddleware(req, res, next);
      });
    },
    closeBundle() {
      if (!isExternal || !fs.existsSync(resolvedScenariosDir)) {
        return;
      }
      const destDir = path.join(resolvedOutDir, 'scenarios');
      fs.mkdirSync(destDir, { recursive: true });
      fs.cpSync(resolvedScenariosDir, destDir, { recursive: true, force: true });
      console.log(
        `[curu-scenarios] copied scenarios from ${resolvedScenariosDir} -> ${destDir}`
      );
    },
  };
}
