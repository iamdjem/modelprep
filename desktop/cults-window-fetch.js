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

// A model file is uploaded as one base64 blob embedded in the script source, so
// this bounds how much a single request may carry. Real STL/3MF meshes run well
// past 64MB, which is where this used to sit; 256MB clears them while still
// refusing anything that could only be a runaway.
const DEFAULT_MAX_BODY_BYTES = 256 * 1024 * 1024;

/**
 * Turn a request body into raw bytes.
 *
 * FormData is the case that matters. It has no useful `toString()`, so the
 * previous fall-through to `Buffer.from(String(body))` encoded every Cults file
 * upload as the 17-byte literal "[object FormData]" — S3 rejected the malformed
 * POST, and because the error response carries no CORS headers the page's fetch
 * surfaced it as a bare "Failed to fetch". Node's Response knows how to encode
 * multipart and reports the boundary it picked, so we borrow it rather than
 * hand-rolling a multipart writer.
 */
async function encodeBody(body) {
  if (Buffer.isBuffer(body)) return { bytes: body, contentType: null };
  if (body instanceof ArrayBuffer) return { bytes: Buffer.from(body), contentType: null };
  if (ArrayBuffer.isView(body)) {
    return { bytes: Buffer.from(body.buffer, body.byteOffset, body.byteLength), contentType: null };
  }
  if (typeof body === 'string') return { bytes: Buffer.from(body), contentType: null };

  // FormData, Blob, URLSearchParams: anything Response can serialize.
  const Encoder = globalThis.Response;
  if (Encoder && (typeof body.arrayBuffer === 'function' || typeof body.getAll === 'function')) {
    const encoded = new Encoder(body);
    return {
      bytes: Buffer.from(await encoded.arrayBuffer()),
      contentType: encoded.headers.get('content-type'),
    };
  }
  return { bytes: Buffer.from(String(body)), contentType: null };
}

async function buildRequestDescriptor(url, options = {}, maxBodyBytes = DEFAULT_MAX_BODY_BYTES) {
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
    const { bytes, contentType } = await encodeBody(options.body);
    if (bytes.byteLength > maxBodyBytes) throw new Error(`Cults in-app request body ${bytes.byteLength} exceeds the ${maxBodyBytes}-byte limit.`);
    // The boundary is chosen during encoding, so the encoder's Content-Type is
    // the only correct one: a caller-supplied header would name a boundary that
    // is not in the body.
    if (contentType) headers['Content-Type'] = contentType;
    bodyBase64 = bytes.toString('base64');
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

/** Strip query strings: they carry signed-URL credentials. */
function redactUrl(url) {
  const value = String(url || '');
  const q = value.indexOf('?');
  return q < 0 ? value : `${value.slice(0, q)}?[redacted]`;
}

// executeInPage(code) -> Promise<envelope> runs the script in the Cults window.
function createWindowFetch(options = {}) {
  const executeInPage = options.executeInPage;
  const ResponseImpl = options.Response || (typeof Response !== 'undefined' ? Response : null);
  const maxBodyBytes = options.maxBodyBytes || DEFAULT_MAX_BODY_BYTES;
  if (typeof executeInPage !== 'function') throw new Error('createWindowFetch requires an executeInPage function.');

  return async (url, opts = {}) => {
    const descriptor = await buildRequestDescriptor(url, opts, maxBodyBytes);
    let envelope;
    try {
      envelope = await executeInPage(buildFetchScript(descriptor));
    } catch (error) {
      throw new Error(`Cults in-app window is unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!envelope || envelope.error) {
      // A bare "Failed to fetch" from the page says nothing about which request
      // died or how big it was, which is exactly what you need to know: this
      // transport carries the whole upload as one base64 blob embedded in a
      // script, so large publishes fail here and nowhere else.
      const detail = envelope?.error || 'Cults in-app request returned no response.';
      const bytes = descriptor.bodyBase64 ? Math.round((descriptor.bodyBase64.length * 3) / 4) : 0;
      const size = bytes ? ` (${descriptor.method} ${bytes.toLocaleString()} bytes)` : ` (${descriptor.method})`;
      throw new Error(`${detail}${size} while calling ${redactUrl(descriptor.url)}`);
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

/**
 * Keep Cloudflare-protected Cults requests in the authenticated page, but send
 * the already-signed storage POST through Electron's network session. The S3
 * policy is the authorization; it neither needs Cults cookies nor benefits
 * from page-origin CORS, which can hide the real S3 response as "Failed to
 * fetch".
 */
function createCultsFetchRouter({ pageFetch, storageFetch }) {
  if (typeof pageFetch !== 'function') throw new Error('createCultsFetchRouter requires pageFetch.');
  if (typeof storageFetch !== 'function') throw new Error('createCultsFetchRouter requires storageFetch.');
  return (url, options) => {
    let hostname = '';
    try { hostname = new URL(String(url)).hostname.toLowerCase(); } catch { /* page transport reports malformed URLs */ }
    return hostname === 's3.eu-west-3.amazonaws.com'
      ? storageFetch(url, options)
      : pageFetch(url, options);
  };
}

function createPacedFetch(fetchImpl, minimumIntervalMs = 200) {
  if (typeof fetchImpl !== 'function') throw new Error('createPacedFetch requires a fetch implementation.');
  let tail = Promise.resolve();
  let lastStartedAt = 0;
  return (url, options) => {
    const run = tail.then(async () => {
      const waitMs = Math.max(0, Number(minimumIntervalMs) - (Date.now() - lastStartedAt));
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      lastStartedAt = Date.now();
      return fetchImpl(url, options);
    });
    tail = run.catch(() => {});
    return run;
  };
}

module.exports = {
  createWindowFetch, createCultsFetchRouter, createPacedFetch, buildFetchScript, buildRequestDescriptor,
  FORBIDDEN_REQUEST_HEADERS, DEFAULT_MAX_BODY_BYTES,
};
