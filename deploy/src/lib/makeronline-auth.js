export const DESKTOP_MAKERONLINE_SECRET = 'desktop-managed-makeronline-session-v1';

export function isDesktopMakerOnlineSession(secret) {
  return secret === DESKTOP_MAKERONLINE_SECRET;
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
  throw new Error('Unsupported desktop MakerOnline request body.');
}

/**
 * MakerOnline uses an authenticated first-party web contract, not a public
 * developer API. Desktop builds keep mo_access_token and cookies in Electron
 * main and expose only allow-listed, Worker-shaped routes to the renderer.
 */
export async function makerOnlineFetch(url, options = {}, secret = '') {
  const bridge = desktopBridge();
  let isMakerOnlineRoute = false;
  try {
    isMakerOnlineRoute = new URL(url).pathname.startsWith('/api/v1/makeronline/web/');
  } catch { /* normal fetch reports malformed URLs */ }

  if (!isDesktopMakerOnlineSession(secret) || !bridge?.requestMakerOnline || !isMakerOnlineRoute) {
    return fetch(url, options);
  }

  const serialized = await serializeBody(options.body);
  const result = await bridge.requestMakerOnline({
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
