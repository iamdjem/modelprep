// Catch-all Pages Function — serves any path as an R2 key from the STAGING
// bucket. Lives at modelprep-cdn.pages.dev/<key> and is the public-facing CDN
// that downstream platforms (Cults, etc.) fetch from.
//
// Why this exists separately from the Worker:
// Cults's cover-image fetcher rejects *.workers.dev and *.r2.dev hostnames
// (probably as ephemeral/dynamic-infra deny-list), but accepts *.pages.dev.
// Same R2 bucket — different (allow-listed) hostname.

interface Env {
  STAGING: R2Bucket;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const method = ctx.request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('method not allowed', { status: 405, headers: { 'allow': 'GET, HEAD' } });
  }

  // ctx.params.path is the catch-all segment array, but it's already URL-decoded
  // per-segment by Pages routing. Reassemble with literal slashes — matches the
  // R2 key shape `staging/<timestamp>-<random>/<filename>`.
  const pathParam = ctx.params.path;
  const segments = Array.isArray(pathParam) ? pathParam : (pathParam ? [pathParam] : []);
  const key = segments.join('/');
  if (!key) return new Response('not found', { status: 404 });

  // HEAD avoids streaming the body from R2 — Cults validates with HEAD first.
  const obj = method === 'HEAD' ? await ctx.env.STAGING.head(key) : await ctx.env.STAGING.get(key);
  if (!obj) return new Response('not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('content-length', String(obj.size));
  headers.set('cache-control', 'public, max-age=86400');
  // CORS — anyone (incl. Cults's fetcher) reads; nothing here is sensitive.
  headers.set('access-control-allow-origin', '*');

  if (method === 'HEAD') return new Response(null, { headers });
  return new Response((obj as R2ObjectBody).body, { headers });
};
