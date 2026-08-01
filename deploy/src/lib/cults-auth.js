const DESKTOP_CULTS_PREFIX = 'desktop-managed-cults-credentials-v1:';

export function desktopCultsSecret(accountId) {
  if (!accountId) throw new Error('A desktop Cults3D account id is required.');
  return `${DESKTOP_CULTS_PREFIX}${accountId}`;
}

export function desktopCultsAccountId(secret) {
  return typeof secret === 'string' && secret.startsWith(DESKTOP_CULTS_PREFIX)
    ? secret.slice(DESKTOP_CULTS_PREFIX.length)
    : null;
}

export function isDesktopCultsSession(secret) {
  return !!desktopCultsAccountId(secret);
}

function desktopBridge() {
  return typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop
    ? window.modelprepDesktop
    : null;
}

async function serializeBody(body) {
  if (body == null) return { bodyType: 'none', body: null };
  if (typeof body === 'string') return { bodyType: 'text', body };
  if (body instanceof FormData) {
    const entries = [];
    for (const [name, value] of body.entries()) {
      if (typeof value === 'string') entries.push({ name, kind: 'text', value });
      else entries.push({
        name,
        kind: 'file',
        fileName: value.name || 'upload.bin',
        mimeType: value.type || 'application/octet-stream',
        bytes: await value.arrayBuffer(),
      });
    }
    return { bodyType: 'form-data', body: entries };
  }
  throw new Error('Unsupported desktop Cults3D request body.');
}

/**
 * Packaged desktop builds send Cults routes to Electron main, which talks
 * directly to Cults/S3. Web builds retain the existing Worker fallback.
 */
export async function cultsFetch(url, options = {}, secret = null) {
  const bridge = desktopBridge();
  const accountId = desktopCultsAccountId(secret);
  let isCultsRoute = false;
  try {
    isCultsRoute = new URL(url).pathname.startsWith('/api/v1/cults3d/web/');
  } catch { /* normal fetch reports malformed URLs */ }

  if (accountId && bridge?.requestCults && isCultsRoute) {
    const headers = { ...(options.headers || {}) };
    delete headers['X-Cults-Email'];
    delete headers['X-Cults-Password'];
    delete headers['x-cults-email'];
    delete headers['x-cults-password'];
    const serialized = await serializeBody(options.body);
    const result = await bridge.requestCults({
      accountId,
      url,
      method: options.method || 'GET',
      headers,
      ...serialized,
    });
    return new Response(result.body || '', {
      status: result.status,
      headers: result.headers || {},
    });
  }

  const headers = { ...(options.headers || {}) };
  if (secret?.email && secret?.password && isCultsRoute) {
    headers['X-Cults-Email'] = secret.email;
    headers['X-Cults-Password'] = secret.password;
  }
  return fetch(url, { ...options, headers });
}
