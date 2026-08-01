export const DESKTOP_MYMINIFACTORY_SECRET = 'desktop-managed-myminifactory-session-v1';

export function isDesktopMyMiniFactorySession(secret) {
  return secret === DESKTOP_MYMINIFACTORY_SECRET;
}

function desktopBridge() {
  return typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop ? window.modelprepDesktop : null;
}

async function serializeBody(body) {
  if (body == null) return { bodyType: 'none', body: null };
  if (typeof body === 'string') return { bodyType: 'text', body };
  if (body instanceof FormData) {
    const entries = [];
    for (const [name, value] of body.entries()) {
      if (typeof value === 'string') entries.push({ name, kind: 'text', value });
      else entries.push({ name, kind: 'file', fileName: value.name || 'upload.bin', mimeType: value.type || 'application/octet-stream', bytes: await value.arrayBuffer() });
    }
    return { bodyType: 'form-data', body: entries };
  }
  throw new Error('Unsupported desktop MyMiniFactory request body.');
}

export async function myMiniFactoryFetch(url, options = {}, secret = '') {
  const bridge = desktopBridge();
  let supported = false;
  try { supported = new URL(url).pathname.startsWith('/api/v1/myminifactory/web/'); } catch { /* fetch reports malformed URLs */ }
  if (!isDesktopMyMiniFactorySession(secret) || !bridge?.requestMyMiniFactory || !supported) return fetch(url, options);
  const serialized = await serializeBody(options.body);
  const result = await bridge.requestMyMiniFactory({ url, method: options.method || 'GET', headers: options.headers || {}, ...serialized });
  return new Response(result.body || '', { status: result.status, headers: result.headers || {} });
}
