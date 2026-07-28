export const DESKTOP_MAKERWORLD_SECRET = 'desktop-managed-session-v1';

export function isDesktopMakerWorldSession(secret) {
  return secret === DESKTOP_MAKERWORLD_SECRET;
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
  throw new Error('Unsupported desktop MakerWorld request body.');
}

/** Fetch a MakerWorld Worker route without exposing the desktop session to the renderer.
 * Web accounts keep using the normal fetch path with their per-browser token. */
export async function makerWorldFetch(url, options = {}, secret = '') {
  const bridge = desktopBridge();
  let isWorkerRoute = false;
  try { isWorkerRoute = new URL(url).pathname.startsWith('/api/v1/makerworld/web/'); } catch { /* normal fetch reports malformed URLs */ }
  if (!isDesktopMakerWorldSession(secret) || !bridge?.requestMakerWorld || !isWorkerRoute) {
    return fetch(url, options);
  }

  const serialized = await serializeBody(options.body);
  const result = await bridge.requestMakerWorld({
    url,
    method: options.method || 'GET',
    headers: options.headers || {},
    ...serialized,
  });
  return new Response(result.body || '', {
    status: result.status,
    headers: result.headers || {},
  });
}
