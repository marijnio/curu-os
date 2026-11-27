import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { createAuthHandler } from './auth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const STATIC_DIR = path.resolve(
  process.env.CURU_STATIC_DIR || path.resolve(__dirname, '..', 'dist')
);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
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
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const COMPRESSIBLE_EXTS = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.ink',
  '.md',
  '.markdown',
  '.txt',
  '.svg',
]);

const auth = createAuthHandler(process.env);

function isInsideDir(targetPath, rootDir) {
  return targetPath === rootDir || targetPath.startsWith(rootDir + path.sep);
}

function getCacheControl(pathname, filePath) {
  if (pathname === '/scenarios' || pathname.startsWith('/scenarios/')) {
    return 'no-cache, no-store, must-revalidate';
  }
  if (pathname.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  if (path.basename(filePath).toLowerCase() === 'index.html') {
    return 'no-cache';
  }
  return 'no-cache';
}

function parseRangeHeader(rangeHeader, totalSize) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;
  const spec = rangeHeader.slice('bytes='.length).split(',')[0].trim();
  const dashIdx = spec.indexOf('-');
  if (dashIdx === -1) return null;

  const startStr = spec.slice(0, dashIdx).trim();
  const endStr = spec.slice(dashIdx + 1).trim();

  let start;
  let end;
  if (startStr === '') {
    const suffixLen = Number.parseInt(endStr, 10);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return 'invalid';
    start = Math.max(0, totalSize - suffixLen);
    end = totalSize - 1;
  } else {
    start = Number.parseInt(startStr, 10);
    end = endStr === '' ? totalSize - 1 : Number.parseInt(endStr, 10);
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= totalSize
  ) {
    return 'invalid';
  }

  return { start, end: Math.min(end, totalSize - 1) };
}

function serveStatic(req, res) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method Not Allowed');
    return;
  }

  const rawPath = (req.url || '/').split('?')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  const pathname = decodedPath.replace(/\/{2,}/g, '/') || '/';
  const relPath = pathname.replace(/^\/+/, '');
  let targetPath = path.resolve(STATIC_DIR, relPath);

  if (!isInsideDir(targetPath, STATIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    targetPath = path.join(targetPath, 'index.html');
  }

  let fileExists = fs.existsSync(targetPath) && fs.statSync(targetPath).isFile();

  if (!fileExists) {
    const isDirectResource =
      pathname === '/scenarios' ||
      pathname.startsWith('/scenarios/') ||
      pathname.startsWith('/assets/') ||
      pathname.startsWith('/api/');

    if (isDirectResource) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const spaFallback = path.join(STATIC_DIR, 'index.html');
    if (!fs.existsSync(spaFallback) || !fs.statSync(spaFallback).isFile()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    targetPath = spaFallback;
    fileExists = true;
  }

  const stat = fs.statSync(targetPath);
  const ext = path.extname(targetPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const cacheControl = getCacheControl(pathname, targetPath);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Accept-Ranges', 'bytes');

  const rangeHeader = req.headers.range;
  if (typeof rangeHeader === 'string') {
    const range = parseRangeHeader(rangeHeader, stat.size);
    if (range === 'invalid') {
      res.statusCode = 416;
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      res.end();
      return;
    }
    if (range) {
      const chunkSize = range.end - range.start + 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
      res.setHeader('Content-Length', String(chunkSize));
      if (method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(targetPath, { start: range.start, end: range.end }).pipe(res);
      return;
    }
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  const shouldGzip =
    COMPRESSIBLE_EXTS.has(ext) &&
    stat.size >= 256 &&
    /\bgzip\b/i.test(acceptEncoding);

  if (shouldGzip) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.statusCode = 200;
    if (method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(targetPath).pipe(zlib.createGzip()).pipe(res);
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Length', String(stat.size));
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(targetPath).pipe(res);
}

const server = http.createServer((req, res) => {
  void auth.handleAuthMiddleware(req, res, () => serveStatic(req, res));
});

const listenPort = Number.isNaN(PORT) ? 8080 : PORT;
server.listen(listenPort, '0.0.0.0', () => {
  console.log(
    `[curu-os] Listening on http://0.0.0.0:${listenPort} (static: ${STATIC_DIR}, auth: ${
      auth.authEnabled ? 'enabled' : 'disabled'
    })`
  );
});
