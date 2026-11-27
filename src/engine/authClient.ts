export interface AuthStatus {
  authEnabled: boolean;
  authenticated: boolean;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch('/api/auth/status', { cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.toLowerCase().includes('application/json')) {
      return { authEnabled: false, authenticated: true };
    }

    const data = (await res.json()) as Partial<AuthStatus>;
    if (typeof data.authEnabled !== 'boolean') {
      return { authEnabled: false, authenticated: true };
    }

    return {
      authEnabled: data.authEnabled,
      authenticated: Boolean(data.authenticated),
    };
  } catch {
    return { authEnabled: false, authenticated: true };
  }
}

export async function submitLogin(password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    let payload: { authenticated?: boolean; error?: string; retryAfterSeconds?: number } = {};
    try {
      payload = (await res.json()) as typeof payload;
    } catch {
      // Ignore non-JSON error body
    }

    if (res.ok && payload.authenticated !== false) {
      return { ok: true };
    }

    return {
      ok: false,
      error: payload.error || `Authentication failed (${res.status}).`,
      retryAfterSeconds: payload.retryAfterSeconds,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to reach authentication server.',
    };
  }
}

export async function submitLogout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore network errors gracefully during sign-out
  }
}
