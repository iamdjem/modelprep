// ModelPrep backend — Worker entry.
//
// All routes are namespaced under /api/v1. This first slice is READ-ONLY
// against the Cults3D GraphQL API to prove auth + wiring. No writes (no
// createCreation) are exposed yet — that lands once we've inspected the
// mutation signature via /api/v1/cults3d/introspect/mutation and decided
// how to safely test it.

import type { Env } from './types';
import {
  cultsMe,
  cultsCategories,
  cultsLicenses,
  cultsMyCreations,
  cultsIntrospectCreate,
  cultsCreateCreation,
  cultsProbeField,
} from './adapters/cults3d';
import { resolveCultsCategory, resolveCultsLicense } from './adapters/cults3d-mappings';
import {
  cultsWebLogin,
  cultsWebUploadFile,
  cultsWebCreateCreation,
  cultsWebPublishPrice,
  cultsWebUnpublish,
} from './adapters/cults3d-web';
import { stageFile, serveFile } from './r2';
import type { PublishPayload } from './types';

// Bytes — cap upload size at the Worker request-body limit. Cloudflare's
// default for Workers Free / Paid is 100 MB; we cap at 95 MB so the JSON
// response can fit in the remaining headroom.
const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;

// Origins allowed to call the Worker. Anything not in this list gets no
// CORS headers — fetch() from those origins will fail in the browser. The
// `r2.dev` curl-from-CLI flow still works because it doesn't send Origin.
// Add new origins here (e.g. a custom domain) rather than reverting to `*`.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',                  // vite dev server
  'http://localhost:4173',                  // vite preview
  'https://iamdjem.github.io',              // GitHub Pages production
]);

/** Pick which Access-Control-Allow-Origin to echo based on the request's
 *  Origin header. Returns `null` for unknown origins so callers can decide
 *  whether to omit the header entirely (cross-origin browser calls then fail
 *  with a CORS error — the secure default). */
function corsOriginFor(req: Request): string | null {
  const origin = req.headers.get('Origin');
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  return null;
}

function corsHeadersFor(req: Request): Record<string, string> {
  const allowed = corsOriginFor(req);
  const base: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cults-Username, X-Cults-Api-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed) base['Access-Control-Allow-Origin'] = allowed;
  return base;
}

/** Build a per-request `json()` closure that carries the right CORS headers
 *  for the request's Origin. Returning a closure (rather than passing `req`
 *  to every json() call) keeps the route bodies tidy. */
function makeJson(req: Request) {
  const cors = corsHeadersFor(req);
  return function json(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body, null, 2), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...cors,
        ...(init.headers ?? {}),
      },
    });
  };
}

/** Build the Cults creds for a request — prefer per-request headers, fall back
 *  to env. The frontend sends `X-Cults-Username` + `X-Cults-Api-Key`; the env
 *  fallback exists so curl tests + the original /publish-test still work. */
function getCreds(req: Request, env: Env): { username: string; apiKey: string } | null {
  const u = req.headers.get('X-Cults-Username') || env.CULTS_USERNAME;
  const k = req.headers.get('X-Cults-Api-Key') || env.CULTS_API_KEY;
  if (!u || !k) return null;
  return { username: u, apiKey: k };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const json = makeJson(req);
    const notFound = () => json({ error: 'not_found' }, { status: 404 });

    if (req.method === 'OPTIONS') {
      // Echo back the per-origin CORS headers for the preflight. Unknown
      // origins get headers without `Access-Control-Allow-Origin`, which the
      // browser then treats as a CORS failure — exactly what we want.
      return new Response(null, { headers: corsHeadersFor(req) });
    }

    // -------------------- health ----------------------------------------
    if (path === '/api/v1/health' && req.method === 'GET') {
      return json({ ok: true, service: 'modelprep-backend', version: '0.1.0' });
    }

    // -------------------- Cults3D read endpoints ------------------------
    if (path.startsWith('/api/v1/cults3d/') && req.method === 'GET') {
      const creds = getCreds(req, env);
      if (!creds) {
        return json({ error: 'missing_credentials', hint: 'Send X-Cults-Username + X-Cults-Api-Key headers, or set them in .dev.vars.' }, { status: 401 });
      }

      try {
        switch (path) {
          case '/api/v1/cults3d/me':
            return json(await cultsMe(creds));
          case '/api/v1/cults3d/categories':
            return json(await cultsCategories(creds));
          case '/api/v1/cults3d/licenses':
            return json(await cultsLicenses(creds));
          case '/api/v1/cults3d/my-creations': {
            const limit = Number(url.searchParams.get('limit') ?? '10');
            const offset = Number(url.searchParams.get('offset') ?? '0');
            return json(await cultsMyCreations(creds, limit, offset));
          }
          case '/api/v1/cults3d/introspect/mutation':
            return json(await cultsIntrospectCreate(creds));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: 'upstream_error', message }, { status: 502 });
      }
    }

    // -------------------- TEST publish (LIVE) ----------------------------
    // Fires a real createCreation against Cults using their own demo files.
    // This WILL create a live, public listing on the authenticated user's
    // profile. Delete it manually from cults3d.com after testing.
    if (path === '/api/v1/cults3d/publish-test' && req.method === 'POST') {
      const creds = getCreds(req, env);
      if (!creds) {
        return json({ error: 'missing_credentials', hint: 'Send X-Cults-Username + X-Cults-Api-Key headers.' }, { status: 401 });
      }

      // Minimum-required payload only — required fields per the docs example.
      // Optional fields (subCategoryIds, licenseCode, etc.) omitted to isolate
      // the source of the "Unexpected error" we got with the full payload.
      const payload: PublishPayload = {
        title: 'ModelPrep API test — please ignore',
        description: 'Automated test upload from ModelPrep validating Cults3D GraphQL integration. The creator will delete this listing shortly after the test completes.',
        coverImageUrl: 'https://placehold.co/2000x1500/0066cc/ffffff.jpg?text=ModelPrep+API+Test',
        modelFileUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/stl/ascii/slotted_disk.stl'],
        categoryId: 'Q2F0ZWdvcnkvMjM',  // Art
        locale: 'EN',
      };

      try {
        const result = await cultsCreateCreation(creds, payload);
        return json({
          ok: true,
          payload,
          response: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: 'upstream_error', message }, { status: 502 });
      }
    }

    // -------------------- Probe candidate mutation fields ----------------
    // Tries each field with a "good guess" type. Uses an unreachable file URL
    // so even a SCHEMA-VALID mutation can't publish. Returns a verdict per
    // field: 'accepted' | 'wrong-type' | 'absent' | 'unknown'.
    if (path === '/api/v1/cults3d/probe-fields' && req.method === 'GET') {
      const creds = getCreds(req, env);
      if (!creds) {
        return json({ error: 'missing_credentials' }, { status: 401 });
      }
      const candidates: Array<{ field: string; type: string; value: unknown }> = [
        // === Discover CreationVisibilityEnum values via a deliberately-bad value ===
        { field: 'visibility',                 type: 'CreationVisibilityEnum',     value: 'PROBE_BAD_ENUM_VALUE_TO_LEARN_OPTIONS' },
        // === Probe each likely visibility value ===
        { field: 'visibility',                 type: 'CreationVisibilityEnum',     value: 'PRIVATE' },
        { field: 'visibility',                 type: 'CreationVisibilityEnum',     value: 'UNLISTED' },
        { field: 'visibility',                 type: 'CreationVisibilityEnum',     value: 'DRAFT' },
        { field: 'visibility',                 type: 'CreationVisibilityEnum',     value: 'HIDDEN' },
        { field: 'visibility',                 type: 'CreationVisibilityEnum',     value: 'PUBLIC' },
        // === Discover usages enum name + values ===
        { field: 'usages',                     type: '[CreationUsageEnum!]',       value: ['PROBE_BAD_ENUM'] },
        { field: 'usages',                     type: '[CreationUsageTypeEnum!]',   value: ['PROBE_BAD_ENUM'] },
        { field: 'usages',                     type: '[CreationUsageType!]',       value: ['PROBE_BAD_ENUM'] },
        { field: 'usages',                     type: '[ManufacturingUsageEnum!]',  value: ['PROBE_BAD_ENUM'] },
        // === metaTags — confirmed [String!]; probe with a clearly-bad value to learn valid ones ===
        { field: 'metaTags',                   type: '[String!]',                  value: ['PROBE_BAD_META_TAG_TO_LEARN_OPTIONS'] },
      ];
      const results = [];
      for (const c of candidates) {
        try {
          // Sequential — be polite about the rate limit (60 / 30s).
          const result = await cultsProbeField(creds, c.field, c.type, c.value);
          // Include raw error messages so we can refine the classifier.
          const rawErrors = (result.raw.errors ?? []).map(e => e.message);
          const dataErrors = result.raw.data?.createCreation?.errors ?? [];
          results.push({ field: c.field, attemptedType: c.type, verdict: result.verdict, errors: rawErrors, dataErrors });
        } catch (err) {
          results.push({
            field: c.field,
            attemptedType: c.type,
            verdict: 'unknown',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return json({ results });
    }

    // -------------------- REAL publish endpoint --------------------------
    // Accepts the platform-neutral frontend body shape (see FrontendPublishBody)
    // plus optional Cults-direct overrides (categoryId, licenseCode, etc.) for
    // power users or test scripts that want to bypass the mapping layer.
    //
    // Resolution order for each field:
    //   1. Cults-direct field if present (`categoryId`, `licenseCode`, `downloadPrice`, `currency`)
    //   2. Mapped from platform-neutral field (`category`, `license`, `price`, `free`)
    //   3. Sensible default (Various / cults_pu / free)
    // Whatever falls back to a default is reported in `substituted` so the UI
    // can show a "your choice wasn't used" warning.
    if (path === '/api/v1/cults3d/publish' && req.method === 'POST') {
      const creds = getCreds(req, env);
      if (!creds) {
        return json({ error: 'missing_credentials', hint: 'Send X-Cults-Username + X-Cults-Api-Key headers.' }, { status: 401 });
      }

      // Body union: PublishPayload fields (Cults-direct) + platform-neutral fields.
      interface FrontendBody extends Partial<PublishPayload> {
        category?: string;   // ModelPrep CATEGORIES string e.g. 'Art & Decor'
        license?: string;    // ModelPrep LICENSES id e.g. 'ccby'
        price?: number;      // numeric price; combined with `free` to derive isPaid
        free?: boolean;      // explicit free flag (overrides price>0)
        tags?: string[];     // user tags — passed through for logging; Cults metaTags enum is undocumented so we don't forward yet
      }

      let body: FrontendBody = {};
      try { body = (await req.json()) as FrontendBody; } catch { /* allow empty body */ }

      const isHttps = (u?: string) => !!u && u.startsWith('https://');
      const httpsFiles = (body.modelFileUrls ?? []).filter(isHttps);
      const httpsGallery = (body.galleryImageUrls ?? []).filter(isHttps);
      const substituted: string[] = [];

      // ---- Pricing: derive isPaid + numeric price + currency -------------
      const explicitFree = body.free === true || body.downloadPrice === 0 || body.price === 0;
      const requestedPrice = body.downloadPrice ?? body.price ?? 0;
      const isPaid = !explicitFree && requestedPrice > 0;
      const downloadPrice = isPaid ? requestedPrice : undefined;
      const currency = isPaid ? (body.currency ?? 'USD') : undefined;

      // ---- Category --------------------------------------------------------
      // Only flag 'category' as substituted when the user picked something
      // we couldn't map. If they didn't pick at all, defaulting to Various
      // isn't really a "substitution" — just a fallback.
      let categoryId = body.categoryId;
      if (!categoryId) {
        const resolved = resolveCultsCategory(body.category);
        categoryId = resolved.categoryId;
        if (resolved.substituted && body.category) substituted.push('category');
      }

      // ---- License (enforces free/paid compatibility) ----------------------
      // Only flag 'license' as substituted when the user actually picked
      // a license. Same reasoning as category — a default isn't a swap.
      let licenseCode = body.licenseCode;
      if (!licenseCode) {
        const resolved = resolveCultsLicense(body.license, isPaid);
        licenseCode = resolved.licenseCode;
        if (resolved.substituted && body.license) substituted.push('license');
      }

      // Tags: Cults's `metaTags: [String!]` field exists but rejects all
      // common-word user tags with "Unknown meta tag" — it's Cults's INTERNAL
      // classification vocabulary (probably things like "verified-source",
      // "print-ready" etc.), not user keywords. We confirmed via probes:
      // 'dragon', 'fan_art', 'remix', 'derivative', 'sponsored' all rejected.
      //
      // So we only forward `body.metaTags` if the caller passed it explicitly
      // (advanced use), and DROP `body.tags` (which the frontend sends from
      // the user's tag chips). When we figure out the dictionary, we can swap
      // back to `body.tags ?? body.metaTags ?? []`. The frontend should keep
      // showing tags in the description / locally for now.
      const tagsRaw = body.metaTags ?? [];
      const tags = Array.from(new Set(
        tagsRaw.map(t => String(t).trim().toLowerCase()).filter(Boolean),
      )).slice(0, 20);
      // Tell the UI that user-typed tags aren't being sent (so it can show a
      // "tags shown only locally, not synced to Cults yet" note).
      if ((body.tags?.length ?? 0) > 0 && tags.length === 0) {
        substituted.push('tags');
      }

      const payload: PublishPayload = {
        title: body.title?.trim() || 'ModelPrep test publish',
        description: body.description?.trim() || 'Sent via the ModelPrep frontend → Worker → Cults3D pipeline.',
        // The frontend stages all files via /api/v1/upload first, so we expect
        // https:// URLs from cdn.makerstats.io. If the caller skipped staging
        // and sent a base64/blob URL, fall back to known-good placeholders.
        coverImageUrl: isHttps(body.coverImageUrl) ? body.coverImageUrl! : 'https://placehold.co/2000x1500/0066cc/ffffff.jpg?text=ModelPrep+API+Test',
        galleryImageUrls: httpsGallery,
        modelFileUrls: httpsFiles.length ? httpsFiles : ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/stl/ascii/slotted_disk.stl'],
        categoryId,
        locale: body.locale || 'EN',
        licenseCode,
        // Optional fields — only include if set (Cults rejects explicit nulls).
        ...(body.subCategoryIds?.length ? { subCategoryIds: body.subCategoryIds } : {}),
        ...(downloadPrice !== undefined ? { downloadPrice } : {}),
        ...(currency ? { currency } : {}),
        ...(tags.length ? { metaTags: tags } : {}),
      };

      // Track media substitutions too, alongside category/license.
      if (!isHttps(body.coverImageUrl)) substituted.push('coverImageUrl');
      if (!httpsFiles.length) substituted.push('modelFileUrls');

      try {
        console.log('[publish] resolved:', {
          cover: payload.coverImageUrl,
          gallery: payload.galleryImageUrls?.length ?? 0,
          files: payload.modelFileUrls.length,
          category: payload.categoryId,
          license: payload.licenseCode,
          price: payload.downloadPrice,
          currency: payload.currency,
          tags: payload.metaTags?.length ?? 0,
          substituted,
        });
        let result = await cultsCreateCreation(creds, payload);
        console.log('[publish] cults response:', JSON.stringify(result));

        // Auto-retry without metaTags if Cults rejected any of them. Cults's
        // tag dictionary isn't documented; rather than fail the whole publish
        // because the user typed an unrecognized tag, we drop the tags and
        // republish — listing still gets created, user sees "tags substituted"
        // in the UI. (Detected as a `metaTags` mention anywhere in the errors.)
        const cultsErrors: string[] = result?.data?.createCreation?.errors ?? [];
        const tagRejected = payload.metaTags?.length && cultsErrors.some(e => /metaTags|meta_tags|tag/i.test(String(e)));
        if (tagRejected) {
          console.log('[publish] tags rejected, retrying without metaTags:', cultsErrors);
          const { metaTags: _drop, ...payloadNoTags } = payload;
          result = await cultsCreateCreation(creds, payloadNoTags as PublishPayload);
          substituted.push('tags');
        }
        return json({ ok: true, payload, substituted, response: result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log('[publish] EXCEPTION:', message);
        return json({ error: 'upstream_error', message }, { status: 502 });
      }
    }

    // -------------------- Cults3D WEB-flow publish ------------------------
    // Drives the same multipart/HTML endpoints the cults3d.com upload form
    // uses. STRICTLY MORE CAPABLE than the GraphQL flow above — files go
    // straight to Cults's S3 (no CDN host-allowlist problem), real tags
    // sync (flat_keywords), `secret` visibility works, and we can deactivate
    // listings afterwards. See backend/src/adapters/cults3d-web.ts for the
    // full reverse-engineered request shape.
    //
    // Accepts multipart/form-data — file parts named `model` (one or more)
    // and `illustration` (one or more, first one becomes the cover), plus
    // text parts for everything else (name, description, categoryId, etc.).
    if (path === '/api/v1/cults3d/web/publish' && req.method === 'POST') {
      // Auth: prefer per-request headers, fall back to env. UNLIKE the
      // GraphQL flow, the web flow needs email + password (not API key).
      const email = req.headers.get('X-Cults-Email') || env.CULTS_EMAIL;
      const password = req.headers.get('X-Cults-Password') || env.CULTS_PASSWORD;
      if (!email || !password) {
        return json({
          error: 'missing_credentials',
          hint: 'Web flow needs X-Cults-Email + X-Cults-Password headers (NOT the API key — that\'s only for the GraphQL /publish endpoint).',
        }, { status: 401 });
      }

      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return json({
          error: 'expected_multipart',
          hint: 'Send multipart/form-data with: name, description, categoryId, currency, pricing, licenseType, visibility text fields + `model` and `illustration` file fields.',
        }, { status: 400 });
      }

      try {
        const form = await req.formData();

        // ---- Pull text fields with sensible defaults ----
        const str = (k: string) => {
          const v = form.get(k);
          return typeof v === 'string' ? v : '';
        };
        const name = str('name').trim() || 'ModelPrep web-flow publish';
        const description = str('description').trim() || 'Sent via ModelPrep web-flow pipeline.';
        const details = str('details');
        const categoryId = Number(str('categoryId')) || 25; // Gadget fallback
        const flatKeywords = str('flatKeywords') || str('tags');
        const currency = str('currency') || 'USD';
        const pricing = (str('pricing') || 'free') as 'free' | 'open' | 'paid';
        const downloadPrice = Number(str('downloadPrice')) || 0;
        const downloadOpenPrice = Number(str('downloadOpenPrice')) || 0;
        const licenseType = str('licenseType') || (pricing === 'free' ? 'cc_pddc' : 'cults_cu');
        const visibility = (str('visibility') || 'secret') as 'public' | 'secret';

        // ---- Collect files: 'model' (one or more) + 'illustration' (one or more) ----
        // Workers' FormData typing claims entries are just string, but at
        // runtime non-string entries are File-like with .name/.size/.type —
        // same workaround as the /api/v1/upload route.
        const models = form.getAll('model').filter(v => v != null && typeof v !== 'string') as unknown as File[];
        const illustrations = form.getAll('illustration').filter(v => v != null && typeof v !== 'string') as unknown as File[];
        if (models.length === 0) {
          return json({ error: 'missing_files', hint: 'At least one `model` file part required (STL/3MF/etc).' }, { status: 400 });
        }
        if (illustrations.length === 0) {
          return json({ error: 'missing_files', hint: 'At least one `illustration` file part required (cover image). First one becomes the cover.' }, { status: 400 });
        }

        // ---- Step 1: log in (gets session cookie + CSRF) ----
        console.log('[web-publish] login');
        const session = await cultsWebLogin(email, password);

        // ---- Step 2: upload each model + illustration, collect their numeric IDs ----
        console.log(`[web-publish] uploading ${models.length} model file(s)`);
        const blueprintIds: number[] = [];
        for (const m of models) {
          const id = await cultsWebUploadFile(session, { blob: m, filename: m.name || 'model.stl' }, 'blueprint');
          blueprintIds.push(id);
        }
        console.log(`[web-publish] uploading ${illustrations.length} illustration(s)`);
        const illustrationIds: number[] = [];
        for (const i of illustrations) {
          const id = await cultsWebUploadFile(session, { blob: i, filename: i.name || 'cover.jpg' }, 'illustration');
          illustrationIds.push(id);
        }

        // ---- Step 3: create the (draft) creation ----
        console.log('[web-publish] create');
        const { slug } = await cultsWebCreateCreation(session, {
          name, description, details,
          categoryId,
          usages: ['3dp'],
          flatKeywords,
          blueprintIds,
          illustrationIds,
          madeWithAi: false,
          showComments: true,
        });

        // ---- Step 4: publish (set price + visibility) ----
        console.log('[web-publish] publish slug=', slug);
        const { designUrl } = await cultsWebPublishPrice(session, slug, {
          currency, pricing, downloadPrice, downloadOpenPrice,
          licenseType, visibility, inStore: true,
        });

        console.log('[web-publish] done →', designUrl);
        return json({
          ok: true,
          slug,
          designUrl,
          blueprintIds,
          illustrationIds,
          payload: { name, description, categoryId, currency, pricing, downloadPrice, licenseType, visibility, flatKeywords },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log('[web-publish] EXCEPTION:', message);
        return json({ error: 'web_flow_failed', message }, { status: 502 });
      }
    }

    // -------------------- Cults3D WEB-flow unpublish ----------------------
    // POST /api/v1/cults3d/web/unpublish with JSON body: { slug: "..." }
    // Calls the deactivate endpoint Cults's "My designs" page uses.
    if (path === '/api/v1/cults3d/web/unpublish' && req.method === 'POST') {
      const email = req.headers.get('X-Cults-Email') || env.CULTS_EMAIL;
      const password = req.headers.get('X-Cults-Password') || env.CULTS_PASSWORD;
      if (!email || !password) {
        return json({ error: 'missing_credentials', hint: 'Need X-Cults-Email + X-Cults-Password.' }, { status: 401 });
      }
      let slug = '';
      try {
        const body = await req.json() as { slug?: string };
        slug = body.slug ?? '';
      } catch { /* allow empty body */ }
      if (!slug) {
        return json({ error: 'missing_slug', hint: 'Body must be JSON with a `slug` string (the part after /en/3d-model/<category>/ in the URL).' }, { status: 400 });
      }
      try {
        const session = await cultsWebLogin(email, password);
        const result = await cultsWebUnpublish(session, slug);
        return json({ ok: true, slug, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: 'web_flow_failed', message }, { status: 502 });
      }
    }

    // -------------------- R2: stage a file from the frontend --------------
    // Accepts multipart/form-data with a single `file` field. Uses caller's
    // Cults creds as a soft anti-abuse check (must hold a real API key).
    if (path === '/api/v1/upload' && req.method === 'POST') {
      const creds = getCreds(req, env);
      if (!creds) {
        return json({ error: 'missing_credentials', hint: 'Send X-Cults-Username + X-Cults-Api-Key headers.' }, { status: 401 });
      }
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return json({ error: 'expected_multipart', hint: 'POST multipart/form-data with a "file" field.' }, { status: 400 });
      }
      try {
        const form = await req.formData();
        const entry = form.get('file');
        // FormData.get returns `string | File | null` in browser typings; in
        // the Worker runtime non-string values are File-like with .name/.size/.type.
        const allKeys: string[] = [];
        for (const k of form.keys()) allKeys.push(k);
        console.log('[upload] formdata keys:', allKeys, 'entryType:', typeof entry, 'isString:', typeof entry === 'string');
        if (!entry || typeof entry === 'string') {
          console.log('[upload] REJECT missing_file_field, contentType=', contentType);
          return json({ error: 'missing_file_field', hint: 'Form must include a "file" field with a Blob.', debug: { keys: allKeys, contentType } }, { status: 400 });
        }
        const file = entry as unknown as File;
        console.log('[upload] file name=', file.name, 'size=', file.size, 'type=', file.type);
        if (file.size > MAX_UPLOAD_BYTES) {
          return json({ error: 'file_too_large', maxBytes: MAX_UPLOAD_BYTES, gotBytes: file.size }, { status: 413 });
        }
        const workerOrigin = new URL(req.url).origin;
        const staged = await stageFile(env, file, {
          filename: file.name || 'upload',
          contentType: file.type || 'application/octet-stream',
          workerOrigin,
        });
        console.log('[upload] staged OK key=', staged.key, 'size=', staged.size);
        return json({ ok: true, ...staged, contentType: file.type || null });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log('[upload] EXCEPTION:', message);
        return json({ error: 'upload_failed', message }, { status: 500 });
      }
    }

    // -------------------- R2: serve a staged file --------------------------
    // Public — this is the URL Cults's fetcher hits. HEAD is supported too
    // because Cults validates with a HEAD request before issuing the real GET.
    if (path.startsWith('/api/v1/files/') && (req.method === 'GET' || req.method === 'HEAD')) {
      // Decode each path segment individually so a key like "staging/abc/foo.jpg"
      // round-trips losslessly even when intermediate clients re-encode `%`.
      const raw = path.slice('/api/v1/files/'.length);
      const key = raw.split('/').map(decodeURIComponent).join('/');
      if (!key) return notFound();
      return serveFile(env, key, req.method === 'HEAD');
    }

    return notFound();
  },
} satisfies ExportedHandler<Env>;
