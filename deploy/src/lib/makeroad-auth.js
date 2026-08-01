export const DESKTOP_MAKEROAD_SECRET = 'desktop-managed-makeroad-session-v1';

export function isDesktopMakerRoadSession(secret) { return secret === DESKTOP_MAKEROAD_SECRET; }

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
  throw new Error('Unsupported desktop MakerRoad request body.');
}

export async function makerRoadFetch(url, options = {}, secret = '') {
  const bridge = typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop ? window.modelprepDesktop : null;
  let trusted = false;
  try { trusted = new URL(url).pathname.startsWith('/api/v1/makeroad/web/'); } catch { /* fetch reports malformed URL */ }
  if (!isDesktopMakerRoadSession(secret) || !bridge?.requestMakerRoad || !trusted) return fetch(url, options);
  const serialized = await serializeBody(options.body);
  const result = await bridge.requestMakerRoad({ url, method: options.method || 'GET', headers: options.headers || {}, ...serialized });
  return new Response(result.body || '', { status: result.status, headers: result.headers || {} });
}
