export const DESKTOP_PRINTABLES_SECRET = 'desktop-managed-printables-session-v1';

export function isDesktopPrintablesSession(secret) {
  return secret === DESKTOP_PRINTABLES_SECRET;
}
function desktopBridge() {
  return typeof window !== 'undefined' && window.modelprepDesktop?.isDesktop
    ? window.modelprepDesktop
    : null;
}

/** Call a Printables Worker route while keeping the raw desktop cookie in the
 * Electron main process. Printables intentionally has no web password/cookie
 * fallback because its first-party OAuth session must not enter localStorage. */
export async function printablesFetch(url, options = {}, secret = '') {
  const bridge = desktopBridge();
  let isWorkerRoute = false;
  try {
    isWorkerRoute = new URL(url).pathname.startsWith('/api/v1/printables/web/');
  } catch { /* normal fetch reports malformed URLs */ }
  if (!isDesktopPrintablesSession(secret) || !bridge?.requestPrintables || !isWorkerRoute) {
    return fetch(url, options);
  }
  if (options.body != null && typeof options.body !== 'string') {
    throw new Error('Printables desktop Worker requests must use a JSON string body.');
  }
  const result = await bridge.requestPrintables({
    url,
    method: options.method || 'GET',
    headers: options.headers || {},
    bodyType: options.body == null ? 'none' : 'text',
    body: options.body ?? null,
  });
  return new Response(result.body || '', {
    status: result.status,
    headers: result.headers || {},
  });
}
