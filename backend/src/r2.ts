// R2 staging helpers. We don't use R2's "public bucket" mode (so we don't have
// to expose pub-<hash>.r2.dev URLs to the world) — instead the Worker itself
// serves the staged files via GET /api/v1/files/:key. That keeps all access
// controlled and means we only need ONE public URL pattern for everything
// downstream (Cults will fetch from https://<our-worker>/api/v1/files/<key>).

import type { Env } from './types';

/** Strip path traversal + weird characters from a filename. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.\.+/g, '_')
    .slice(0, 200);
}

/** Generate a short random key segment using the Worker runtime's crypto. */
function randomId(bytes = 12): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  // URL-safe base64-ish, no padding.
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Public CDN base where the staged R2 files are served back. Cloudflare
 *  Pages project `modelprep-cdn` is bound to this domain and has the same R2
 *  binding — so this URL hits Pages, which reads from the same bucket.
 *
 *  Why a custom domain instead of the Worker URL: Cults3D's cover-image
 *  fetcher denies *.workers.dev / *.r2.dev / *.pages.dev (all of Cloudflare's
 *  shared subdomains). Custom domains pass the allow-list. See
 *  cults-host-deny-list-2026-05 in memory for the full investigation. */
const PUBLIC_CDN_BASE = 'https://cdn.makerstats.io';

/** Store a Blob in R2 under a freshly-generated key and return the key +
 *  public URL the caller should hand to downstream services (Cults, etc). */
export async function stageFile(
  env: Env,
  body: Blob | ArrayBuffer | ReadableStream,
  opts: { filename: string; contentType?: string; workerOrigin: string },
): Promise<{ key: string; url: string; size: number | null }> {
  const filename = sanitizeFilename(opts.filename);
  const key = `staging/${Date.now()}-${randomId()}/${filename}`;

  const put = await env.STAGING.put(key, body, {
    httpMetadata: {
      contentType: opts.contentType || 'application/octet-stream',
      // Long max-age so Cults's fetcher can cache, but we rely on R2 lifecycle
      // (configured separately) to auto-expire objects after ~48 hours.
      cacheControl: 'public, max-age=86400',
    },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  // Encode each path segment individually — leaves `/` literal so no HTTP
  // client (notably Cults's server-side fetcher) can double-encode it. The
  // workerOrigin arg is kept around for callers but the public URL is on the
  // custom CDN domain, not workers.dev.
  const encodedPath = key.split('/').map(encodeURIComponent).join('/');
  const url = `${PUBLIC_CDN_BASE}/${encodedPath}`;
  return { key, url, size: put.size ?? null };
}

/** Serve a previously-staged file back to whoever fetches it (notably Cults's
 *  server-side file-fetcher). Returns 404 if missing. When `headOnly` is true,
 *  returns the headers (incl. content-length) without streaming the body — for
 *  HEAD requests, which Cults uses to pre-validate the URL before downloading. */
export async function serveFile(env: Env, key: string, headOnly = false): Promise<Response> {
  // For HEAD, .head() avoids fetching the body stream from R2 at all.
  const obj = headOnly ? await env.STAGING.head(key) : await env.STAGING.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  headers.set('content-length', String(obj.size));
  // CORS — anyone (incl. Cults's fetcher) can read; this isn't sensitive data.
  headers.set('access-control-allow-origin', '*');
  if (headOnly) return new Response(null, { headers });
  return new Response((obj as R2ObjectBody).body, { headers });
}
