export const DESKTOP_NEXPRINT_SECRET = 'desktop-managed-nexprint-session-v1';

export function isDesktopNexprintSession(secret) {
  return secret === DESKTOP_NEXPRINT_SECRET;
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
  throw new Error('Unsupported desktop Nexprint request body.');
}

/**
 * Nexprint's upload contract is an authenticated first-party web flow, not a
 * public developer API. Packaged desktop builds keep the bearer session in
 * Electron main and expose only Worker-shaped, allow-listed requests here.
 */
export async function nexprintFetch(url, options = {}, secret = '') {
  const bridge = desktopBridge();
  let isNexprintRoute = false;
  try {
    isNexprintRoute = new URL(url).pathname.startsWith('/api/v1/nexprint/web/');
  } catch { /* normal fetch reports malformed URLs */ }

  if (!isDesktopNexprintSession(secret) || !bridge?.requestNexprint || !isNexprintRoute) {
    return fetch(url, options);
  }

  const serialized = await serializeBody(options.body);
  const result = await bridge.requestNexprint({
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
