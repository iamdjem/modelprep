export const DESKTOP_CREALITY_SECRET = 'desktop-managed-creality-session-v1';

export function isDesktopCrealitySession(secret) {
  return secret === DESKTOP_CREALITY_SECRET;
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
      if (typeof value === 'string') {
        entries.push({ name, kind: 'text', value });
      } else {
        entries.push({
          name,
          kind: 'file',
          fileName: value.name || 'upload.bin',
          mimeType: value.type || 'application/octet-stream',
          bytes: await value.arrayBuffer(),
        });
      }
    }
    return { bodyType: 'form-data', body: entries };
  }
  throw new Error('Unsupported desktop Creality request body.');
}

// Creality has no documented third-party model-upload API. Desktop requests are
// allow-listed Worker-shaped messages that execute against the first-party web
// contract in Electron main; credentials never enter the renderer or Worker.
export async function crealityFetch(url, options = {}, secret = '') {
  const bridge = desktopBridge();
  let isCrealityRoute = false;
  try {
    isCrealityRoute = new URL(url).pathname.startsWith('/api/v1/creality/web/');
  } catch { /* normal fetch reports malformed URLs */ }
  if (!isDesktopCrealitySession(secret) || !bridge?.requestCreality || !isCrealityRoute) {
    return fetch(url, options);
  }
  const serialized = await serializeBody(options.body);
  const result = await bridge.requestCreality({
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
