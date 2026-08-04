'use strict';

// Cults3D in-app browser fetch.
//
// Cloudflare rejects requests made from Electron's Node/main context (via
// session.fetch) even when they carry the partition's cookies, because they
// lack the genuine rendered-page browser context that passed the challenge.
// The fix, with no extension and nothing to install: run each Cults request
// INSIDE the app's own signed-in Cults window (a real Chromium page on the
// cults3d.com origin) via webContents.executeJavaScript. The request then goes
// out with the exact browser context Cloudflare already cleared — the same way
// Cults' own uploader page issues them.
//
// The Cults client (cults-direct.js) is unchanged: it is built around an
// injected fetchImpl, so this is simply a different fetch. It also relies on
// `redirect: 'manual'` semantics (status 302 + a Location header) to detect
// sign-in/confirmation redirects; page `fetch` can't expose those, so when the
// caller asks for manual redirects we follow them and re-synthesize a 302 whose
// Location is the final URL, preserving the client's existing checks.

// Headers the browser forbids scripts from setting on fetch(); it ignores them,
// and the real page supplies them itself.
const FORBIDDEN_REQUEST_HEADERS = new Set([
  'cookie', 'user-agent', 'origin', 'referer', 'host', 'content-length',
  'connection', 'accept-encoding',
]);

function buildRequestDescriptor(url, options = {}, maxBodyBytes = 64 * 1024 * 1024) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = {};
  const source = options.headers;
  const add = (key, value) => {
    if (value == null) return;
    if (FORBIDDEN_REQUEST_HEADERS.has(String(key).toLowerCase())) return;
    headers[key] = String(value);
  };
  if (source && typeof source.forEach === 'function') source.forEach((value, key) => add(key, value));
  else if (source && typeof source === 'object') for (const [key, value] of Object.entries(source)) add(key, value);

  let bodyBase64 = null;
  if (options.body != null) {
    const buf = Buffer.isBuffer(options.body)
      ? options.body
      : options.body instanceof ArrayBuffer
        ? Buffer.from(options.body)
        : ArrayBuffer.isView(options.body)
          ? Buffer.from(options.body.buffer, options.body.byteOffset, options.body.byteLength)
          : Buffer.from(String(options.body));
    if (buf.byteLength > maxBodyBytes) throw new Error(`Cults in-app request body ${buf.byteLength} exceeds the ${maxBodyBytes}-byte limit.`);
    bodyBase64 = buf.toString('base64');
  }

  return {
    url: String(url),
    method,
    headers,
    bodyBase64,
    manualRedirect: (options.redirect || 'follow') === 'manual',
  };
}

// The script run inside the Cults page. Returns a JSON-serializable envelope;
// executeJavaScript resolves with the awaited value. Embedded request data is
// JSON (with the two JS-hostile separators escaped) so it can't break out.
function buildFetchScript(descriptor) {
  const json = JSON.stringify(descriptor)
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029');
  return `(async () => {
  const req = ${json};
  try {
    const init = { method: req.method, credentials: 'include', redirect: 'follow' };
    if (req.headers && Object.keys(req.headers).length) init.headers = req.headers;
    if (req.bodyBase64 != null) {
      const bin = atob(req.bodyBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      init.body = bytes;
    }
    const res = await fetch(req.url, init);
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    let status = res.status;
    let statusText = res.statusText;
    if (req.manualRedirect && res.redirected) { status = 302; headers['location'] = res.url; }
    return { status: status, statusText: statusText, headers: headers, bodyBase64: btoa(bin), finalUrl: res.url };
  } catch (e) {
    return { error: (e && e.message) ? e.message : String(e) };
  }
})()`;
}

// executeInPage(code) -> Promise<envelope> runs the script in the Cults window.
function createWindowFetch(options = {}) {
  const executeInPage = options.executeInPage;
  const ResponseImpl = options.Response || (typeof Response !== 'undefined' ? Response : null);
  const maxBodyBytes = options.maxBodyBytes || 64 * 1024 * 1024;
  if (typeof executeInPage !== 'function') throw new Error('createWindowFetch requires an executeInPage function.');

  return async (url, opts = {}) => {
    const descriptor = buildRequestDescriptor(url, opts, maxBodyBytes);
    let envelope;
    try {
      envelope = await executeInPage(buildFetchScript(descriptor));
    } catch (error) {
      throw new Error(`Cults in-app window is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!envelope || envelope.error) {
      throw new Error(envelope?.error || 'Cults in-app request returned no response.');
    }
    if (!ResponseImpl) throw new Error('No Response implementation available in this runtime.');
    const body = envelope.bodyBase64 ? Buffer.from(envelope.bodyBase64, 'base64') : null;
    return new ResponseImpl(body, {
      status: envelope.status || 200,
      statusText: envelope.statusText || '',
      headers: envelope.headers && typeof envelope.headers === 'object' ? envelope.headers : {},
    });
  };
}

module.exports = { createWindowFetch, buildFetchScript, buildRequestDescriptor, FORBIDDEN_REQUEST_HEADERS };
