import crypto from 'node:crypto';

const COOKIE_NAME = 'curu_session';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const MAX_BODY_BYTES = 4096;

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.end(body);
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      out[key] = val;
    }
  }
  return out;
}

function extractClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0 && xff[0]) {
    return String(xff[0]).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function shouldUseSecureCookie(req, mode) {
  if (mode === 'true') return true;
  if (mode === 'false') return false;
  if (req.socket?.encrypted) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        const err = new Error('Payload too large');
        err.statusCode = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const err = new Error('Invalid JSON body');
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

export function createAuthHandler(env = process.env) {
  const password = (env.CURU_PASSWORD || '').trim();
  const authEnabled = password.length > 0;
  const sessionSecret =
    (env.CURU_SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');

  const parsedTtl = Number.parseFloat(env.CURU_SESSION_TTL_HOURS || '24');
  const ttlHours = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : 24;
  const ttlSeconds = Math.max(60, Math.round(ttlHours * 3600));

  const cookieSecureMode = (env.CURU_COOKIE_SECURE || 'auto').trim().toLowerCase();
  const passwordDigest = authEnabled
    ? crypto.createHash('sha256').update(password, 'utf8').digest()
    : null;

  const failedAttempts = new Map();

  function signExpiration(expUnixSeconds) {
    return crypto
      .createHmac('sha256', sessionSecret)
      .update(String(expUnixSeconds))
      .digest('hex');
  }

  function verifyPassword(candidate) {
    if (!passwordDigest || typeof candidate !== 'string') return false;
    const candidateDigest = crypto.createHash('sha256').update(candidate, 'utf8').digest();
    return crypto.timingSafeEqual(candidateDigest, passwordDigest);
  }

  function isAuthenticated(req) {
    if (!authEnabled) return true;
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[COOKIE_NAME];
    if (!token || typeof token !== 'string') return false;

    const dotIdx = token.indexOf('.');
    if (dotIdx <= 0) return false;

    const expStr = token.slice(0, dotIdx);
    const sigHex = token.slice(dotIdx + 1);
    if (!/^\d+$/.test(expStr) || !/^[0-9a-f]+$/i.test(sigHex)) return false;

    const exp = Number.parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
      return false;
    }

    const expectedHex = signExpiration(exp);
    const actualBuf = Buffer.from(sigHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  }

  function pruneStaleAttempts(now) {
    if (failedAttempts.size <= 1000) return;
    for (const [ip, timestamps] of failedAttempts.entries()) {
      const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (recent.length === 0) {
        failedAttempts.delete(ip);
      } else {
        failedAttempts.set(ip, recent);
      }
    }
  }

  function checkRateLimit(ip, now) {
    const existing = failedAttempts.get(ip);
    if (!existing || existing.length === 0) return { limited: false, retryAfterSeconds: 0 };
    const recent = existing.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      failedAttempts.delete(ip);
      return { limited: false, retryAfterSeconds: 0 };
    }
    failedAttempts.set(ip, recent);
    if (recent.length >= RATE_LIMIT_MAX_ATTEMPTS) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000)
      );
      return { limited: true, retryAfterSeconds };
    }
    return { limited: false, retryAfterSeconds: 0 };
  }

  function recordFailure(ip, now) {
    pruneStaleAttempts(now);
    const recent = (failedAttempts.get(ip) || []).filter(
      (t) => now - t < RATE_LIMIT_WINDOW_MS
    );
    recent.push(now);
    failedAttempts.set(ip, recent);
  }

  function buildSessionCookie(token, maxAge, secure) {
    return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${
      secure ? '; Secure' : ''
    }`;
  }

  async function handleAuthMiddleware(req, res, next) {
    const rawPath = (req.url || '/').split('?')[0];
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(rawPath);
    } catch {
      sendJson(res, 400, { error: 'Bad Request' });
      return;
    }

    const pathname = decodedPath.replace(/\/{2,}/g, '/') || '/';
    const method = (req.method || 'GET').toUpperCase();

    if (pathname === '/api/auth/status' && method === 'GET') {
      sendJson(res, 200, {
        authEnabled,
        authenticated: !authEnabled || isAuthenticated(req),
      });
      return;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      if (!authEnabled) {
        sendJson(res, 200, { authenticated: true });
        return;
      }

      const ip = extractClientIp(req);
      const now = Date.now();
      const limitState = checkRateLimit(ip, now);
      if (limitState.limited) {
        sendJson(
          res,
          429,
          {
            error: 'Too many failed attempts. Try again later.',
            retryAfterSeconds: limitState.retryAfterSeconds,
          },
          { 'Retry-After': String(limitState.retryAfterSeconds) }
        );
        return;
      }

      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        const statusCode = err && typeof err.statusCode === 'number' ? err.statusCode : 400;
        sendJson(res, statusCode, {
          error: statusCode === 413 ? 'Request payload too large.' : 'Invalid JSON body.',
        });
        return;
      }

      const candidate = typeof body?.password === 'string' ? body.password : '';
      if (!verifyPassword(candidate)) {
        recordFailure(ip, now);
        sendJson(res, 401, { error: 'Invalid access password.' });
        return;
      }

      failedAttempts.delete(ip);
      const exp = Math.floor(now / 1000) + ttlSeconds;
      const token = `${exp}.${signExpiration(exp)}`;
      const secure = shouldUseSecureCookie(req, cookieSecureMode);
      sendJson(
        res,
        200,
        { authenticated: true },
        { 'Set-Cookie': buildSessionCookie(token, ttlSeconds, secure) }
      );
      return;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      const secure = shouldUseSecureCookie(req, cookieSecureMode);
      sendJson(
        res,
        200,
        { authenticated: false },
        { 'Set-Cookie': buildSessionCookie('', 0, secure) }
      );
      return;
    }

    if (pathname.startsWith('/api/auth/')) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (
      authEnabled &&
      (pathname === '/scenarios' || pathname.startsWith('/scenarios/')) &&
      !isAuthenticated(req)
    ) {
      sendJson(res, 401, { error: 'Authentication required' });
      return;
    }

    next();
  }

  return {
    authEnabled,
    isAuthenticated,
    handleAuthMiddleware,
  };
}
