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
import { resolveCultsCategory, resolveCultsCategoryInt, resolveCultsLicense } from './adapters/cults3d-mappings';
import {
  cultsWebLogin,
  cultsWebUploadFile,
  cultsWebCreateCreation,
  cultsWebPublishPrice,
  cultsWebUnpublish,
  cultsWebDelete,
  cultsWebListMyCreations,
} from './adapters/cults3d-web';
import {
  mwCheckSession,
  mwUploadFile,
  mwCreateDraft,
  mwPublish,
  mwDelete,
  mwListMyDesigns,
  mwSuggestTags,
  mwFetchCatalogStandalone,
  mwSearchRelatedDesigns,
  mwFetchOriginalRef,
  mwRefreshToken,
  mwCreateLaserCutDraft,
  mwPublishLaserCut,
  mwDeleteLaserCut,
  type MakerWorldSession,
  type MakerWorldPublishInput,
  type BomCatalog,
  type LaserCutPublishInput,
} from './adapters/makerworld-web';
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
    // Per-request auth headers — add new ones here whenever a route accepts
    // them (browsers strictly enforce this list on CORS preflight).
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cults-Username, X-Cults-Api-Key, X-Cults-Email, X-Cults-Password, X-MW-Cookie',
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
    // GraphQL-flow GET routes — auth is X-Cults-Username + X-Cults-Api-Key.
    // The web-flow GET routes (/api/v1/cults3d/web/*) auth differently
    // (email + password) and are handled later in their own blocks — skip
    // this dispatcher for those so it doesn't reject them on the wrong creds.
    if (path.startsWith('/api/v1/cults3d/') && !path.startsWith('/api/v1/cults3d/web/') && req.method === 'GET') {
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
        const substituted: string[] = [];

        // ---- Pull text fields with sensible defaults ----
        const str = (k: string) => {
          const v = form.get(k);
          return typeof v === 'string' ? v : '';
        };
        const name = str('name').trim() || 'ModelPrep web-flow publish';
        const description = str('description').trim() || 'Sent via ModelPrep web-flow pipeline.';
        const details = str('details');

        // Category: accept either a raw `categoryId` (integer) OR a
        // platform-neutral `category` string like 'Toys & Games' and map it
        // via cults3d-mappings. Same fallback semantics as the GraphQL route.
        let categoryId = Number(str('categoryId'));
        if (!Number.isFinite(categoryId) || categoryId <= 0) {
          const r = resolveCultsCategoryInt(str('category') || undefined);
          categoryId = r.categoryId;
          if (r.substituted && str('category')) substituted.push('category');
        }

        // Tags: accept either pre-joined `flatKeywords` OR a `tags` JSON array
        // OR a single `tags` string. Cults's field is space-separated text.
        let flatKeywords = str('flatKeywords');
        if (!flatKeywords) {
          // form.getAll('tags') handles repeated multipart parts; first value
          // could be a JSON array too if the caller chose that shape.
          const tagsAll = form.getAll('tags').filter(v => typeof v === 'string') as string[];
          let parsed: string[] = [];
          if (tagsAll.length === 1) {
            try { parsed = JSON.parse(tagsAll[0]); } catch { parsed = [tagsAll[0]]; }
          } else {
            parsed = tagsAll;
          }
          flatKeywords = parsed.filter(Boolean).join(' ');
        }

        // Pricing: Cults's actual enum values are 'free' / 'priced' / 'open_priced'
        // (NOT 'paid' / 'open' — those get "Pricing isn't included in the list").
        // The frontend sends platform-neutral `{free, price}`; we derive.
        const explicitFree = str('free') === 'true' || str('pricing') === 'free' || str('price') === '0';
        const priceNum = Number(str('downloadPrice') || str('price'));
        const isPaid = !explicitFree && Number.isFinite(priceNum) && priceNum > 0;
        // Allow caller to send Cults-direct `pricing` too (for power users /
        // curl), but normalize legacy 'paid'/'open' aliases just in case.
        const rawPricing = str('pricing');
        const pricing = (
          rawPricing === 'paid' ? 'priced'
          : rawPricing === 'open' ? 'open_priced'
          : rawPricing || (isPaid ? 'priced' : 'free')
        ) as 'free' | 'priced' | 'open_priced';
        const downloadPrice = isPaid ? priceNum : 0;
        const downloadOpenPrice = Number(str('downloadOpenPrice')) || 0;
        const currency = str('currency') || 'USD';

        // License: accept Cults-direct `licenseType` OR ModelPrep `license`
        // ('ccby' etc.) and resolve via mappings, enforcing free/paid rules.
        let licenseType = str('licenseType');
        if (!licenseType) {
          const r = resolveCultsLicense(str('license') || undefined, isPaid);
          licenseType = r.licenseCode;
          if (r.substituted && str('license')) substituted.push('license');
        }

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
        // From here on, if anything throws, the just-created draft is an
        // orphan. We catch + auto-deactivate so it doesn't accumulate on the
        // user's My Designs page. (Cults has no real DELETE, but unpublish
        // at least marks it OFFLINE so it doesn't pretend to be live.)
        console.log('[web-publish] publish slug=', slug);
        let designUrl: string;
        try {
          const r = await cultsWebPublishPrice(session, slug, {
            currency, pricing, downloadPrice, downloadOpenPrice,
            licenseType, visibility, inStore: true,
          });
          designUrl = r.designUrl;
        } catch (publishErr) {
          const publishMsg = publishErr instanceof Error ? publishErr.message : String(publishErr);
          console.log('[web-publish] publish failed, auto-deactivating draft slug=', slug, ':', publishMsg);
          // Best-effort cleanup — don't let an unpublish failure mask the
          // real publish error. If this also fails, the user still sees the
          // primary error; the orphan just stays around.
          try {
            await cultsWebUnpublish(session, slug);
            console.log('[web-publish] auto-deactivate succeeded');
          } catch (unpubErr) {
            const unpubMsg = unpubErr instanceof Error ? unpubErr.message : String(unpubErr);
            console.log('[web-publish] auto-deactivate ALSO failed (orphan left in My Designs):', unpubMsg);
          }
          // Re-throw the original publish error with a hint about the cleanup attempt.
          throw new Error(`${publishMsg} [auto-deactivated the draft so it won't show as live; check My Designs to permanently delete]`);
        }

        console.log('[web-publish] done →', designUrl, 'substituted:', substituted);
        return json({
          ok: true,
          slug,
          designUrl,
          blueprintIds,
          illustrationIds,
          substituted,
          payload: { name, description, categoryId, currency, pricing, downloadPrice, licenseType, visibility, flatKeywords },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log('[web-publish] EXCEPTION:', message);
        return json({ error: 'web_flow_failed', message }, { status: 502 });
      }
    }

    // -------------------- Cults3D WEB-flow LIST MY CREATIONS --------------
    // GET /api/v1/cults3d/web/my-creations — scrapes /en/creations/mine HTML
    // and returns each listing with status (public/secret/offline), price,
    // thumbnail, slug. Unlike the GraphQL my-creations query, this INCLUDES
    // offline drafts (which is the whole point — needed for the My Listings
    // panel in the frontend to deactivate or delete them).
    if (path === '/api/v1/cults3d/web/my-creations' && req.method === 'GET') {
      const email = req.headers.get('X-Cults-Email') || env.CULTS_EMAIL;
      const password = req.headers.get('X-Cults-Password') || env.CULTS_PASSWORD;
      if (!email || !password) {
        return json({ error: 'missing_credentials', hint: 'Need X-Cults-Email + X-Cults-Password.' }, { status: 401 });
      }
      try {
        const session = await cultsWebLogin(email, password);
        const creations = await cultsWebListMyCreations(session);
        return json({ ok: true, count: creations.length, creations });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: 'web_flow_failed', message }, { status: 502 });
      }
    }

    // -------------------- Cults3D WEB-flow DELETE -------------------------
    // POST /api/v1/cults3d/web/delete with JSON body: { slug: "..." }
    // Permanently removes the listing from Cults (irreversible). For "hide
    // but might re-publish later", use /web/unpublish instead.
    if (path === '/api/v1/cults3d/web/delete' && req.method === 'POST') {
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
        return json({ error: 'missing_slug', hint: 'Body must be JSON with a `slug` string.' }, { status: 400 });
      }
      try {
        const session = await cultsWebLogin(email, password);
        const result = await cultsWebDelete(session, slug);
        return json({ ok: true, slug, deleted: true, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: 'web_flow_failed', message }, { status: 502 });
      }
    }

    // -------------------- Cults3D WEB-flow unpublish ----------------------
    // POST /api/v1/cults3d/web/unpublish with JSON body: { slug: "..." }
    // Deactivates the listing (softer than delete — listing stays on the
    // owner's My Designs as OFFLINE, can be re-activated). For permanent
    // removal use /web/delete.
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

    // ==================== MakerWorld WEB flow ============================
    // Auth = the user's own MakerWorld session, forwarded as the full Cookie
    // header value in `X-MW-Cookie` (minimally `token=…; cf_clearance=…`).
    // We cannot log in server-side (Bambu SSO + Cloudflare), so the cookie is
    // supplied by the browser (extension/paste). See backend/docs/makerworld-web-flow.md.
    const getMwSession = (): MakerWorldSession | null => {
      const cookie = req.headers.get('X-MW-Cookie');
      return cookie ? { cookie } : null;
    };
    const mwAuthError = () =>
      json({ error: 'missing_makerworld_session', hint: 'Send X-MW-Cookie with your MakerWorld session (token=…; cf_clearance=…).' }, { status: 401 });

    // GET /api/v1/makerworld/web/check — is the supplied cookie a valid session?
    if (path === '/api/v1/makerworld/web/check' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      try { return json({ ok: await mwCheckSession(s) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/my-creations — list my published designs.
    if (path === '/api/v1/makerworld/web/my-creations' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      try { return json({ ok: true, designs: await mwListMyDesigns(s) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/bom-catalog — the Maker's Supply BOM catalog
    // (kits/filaments/materials) for the picker. Served from an R2 cache.
    // NOTE: the catalog lives only in the edit-page SSR data, and Cloudflare 403s
    // SERVER-SIDE fetches of MakerWorld HTML/_next/data (only /api/v1/* passes
    // server-side). So the server-side self-refresh below is BEST-EFFORT — it may
    // succeed from the deployed Cloudflare edge (orange-to-orange) but is blocked
    // from ordinary IPs. The RELIABLE refresh is the browser harvest
    // (backend/scripts/harvest-bom-catalog.mjs) which writes the bundled seed; the
    // frontend always has that seed as the offline fallback.
    if (path === '/api/v1/makerworld/web/bom-catalog' && req.method === 'GET') {
      const CATALOG_KEY = 'cache/mw-bom-catalog.json';
      const CATALOG_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
      let cached: BomCatalog | null = null;
      try { const obj = await env.STAGING.get(CATALOG_KEY); if (obj) cached = await obj.json() as BomCatalog; } catch { /* */ }
      const fresh = cached?.fetchedAt && (Date.now() - Date.parse(cached.fetchedAt) < CATALOG_TTL_MS);
      if (fresh) return json({ ok: true, source: 'cache', catalog: cached });
      const s = getMwSession();
      if (s) {
        try {
          const catalog = await mwFetchCatalogStandalone(s);
          await env.STAGING.put(CATALOG_KEY, JSON.stringify(catalog), { httpMetadata: { contentType: 'application/json' } });
          return json({ ok: true, source: 'refreshed', catalog });
        } catch (err) { /* fall back to stale/none below */ }
      }
      if (cached) return json({ ok: true, source: 'stale', catalog: cached });
      return json({ ok: false, error: 'no_catalog', hint: 'Send X-MW-Cookie once to populate the catalog (or use the bundled seed in the frontend).' }, { status: 404 });
    }

    // GET /api/v1/makerworld/web/suggest-tags?keyword=foo — tag autocomplete.
    if (path === '/api/v1/makerworld/web/suggest-tags' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      const keyword = url.searchParams.get('keyword') || '';
      try { return json({ ok: true, suggestions: await mwSuggestTags(s, keyword) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // POST /api/v1/makerworld/web/upload — multipart `file` (+ optional `useType`,
    // `fileName`). Presigns + PUTs to MakerWorld's S3, returns the CDN url to
    // reference in a draft. The browser uploads each model/cover/3mf file this way.
    if (path === '/api/v1/makerworld/web/upload' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return json({ error: 'expected_multipart', hint: 'POST multipart/form-data with a "file" field.' }, { status: 400 });
      }
      try {
        const form = await req.formData();
        const entry = form.get('file');
        if (!entry || typeof entry === 'string') return json({ error: 'no_file' }, { status: 400 });
        const file = entry as unknown as { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
        if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'file_too_large', maxBytes: MAX_UPLOAD_BYTES }, { status: 413 });
        const fileName = (form.get('fileName') as string) || file.name;
        const useType = (form.get('useType') as string) || 'makerworld/model';
        const uploaded = await mwUploadFile(s, fileName, await file.arrayBuffer(), useType);
        return json({ ok: true, ...uploaded });
      } catch (err) {
        return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 });
      }
    }

    // POST /api/v1/makerworld/web/publish — JSON MakerWorldPublishInput (with
    // already-uploaded file urls). Creates a draft and publishes it. Body may set
    // `draftOnly: true` to stop after create (save as draft, no submit).
    if (path === '/api/v1/makerworld/web/publish' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      let input: MakerWorldPublishInput & { draftOnly?: boolean };
      try { input = await req.json() as MakerWorldPublishInput & { draftOnly?: boolean }; }
      catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!input?.title || !input?.coverUrl) {
        return json({ error: 'missing_fields', hint: 'Need at least title + coverUrl. To publish (not draft): also categoryId, description, coverPortraitUrl; .3mf models need printProfile.' }, { status: 400 });
      }
      // Resolve remix originals to their full {link,designId,meta} entries (a bare id
      // fails MakerWorld's submit). Best-effort: if a lookup fails, fall back to the id.
      if (input.modelSource === 'remix' && input.remixOriginalIds?.length && !input.resolvedOriginals) {
        try { input.resolvedOriginals = await Promise.all(input.remixOriginalIds.map((id) => mwFetchOriginalRef(s, id))); }
        catch { /* fall back to remixOriginalIds in buildDraftPayload */ }
      }
      let createdId = 0;
      try {
        createdId = await mwCreateDraft(s, input);
        if (input.draftOnly) return json({ ok: true, id: createdId, status: 'draft' });
        await mwPublish(s, createdId, input);
        return json({ ok: true, id: createdId, status: 'verifying', url: `https://makerworld.com/en/my/models/drafts/${createdId}/edit` });
      } catch (err) {
        // Submit/publish failed AFTER the draft was created → delete it so we never
        // orphan a half-built draft on the user's account. Report whether cleanup ran.
        let cleanedUp = false;
        if (createdId) { try { await mwDelete(s, createdId); cleanedUp = true; } catch { /* best effort */ } }
        return json({ error: 'mw_publish_failed', message: err instanceof Error ? err.message : String(err), draftId: createdId || undefined, cleanedUp }, { status: 502 });
      }
    }

    // POST /api/v1/makerworld/web/delete — JSON { id }. Deletes a draft/model.
    if (path === '/api/v1/makerworld/web/delete' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      let id = 0;
      try { id = ((await req.json()) as { id?: number }).id ?? 0; } catch { /* */ }
      if (!id) return json({ error: 'missing_id' }, { status: 400 });
      try { await mwDelete(s, id); return json({ ok: true, id, deleted: true }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/related?type=0|1&keyword= — search the user's own designs
    // to link (type 0 = 3D models, 1 = Laser & Cut) for remix / related-model fields.
    if (path === '/api/v1/makerworld/web/related' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      const type = url.searchParams.get('type') === '1' ? 1 : 0;
      const keyword = url.searchParams.get('keyword') || '';
      try { return json({ ok: true, designs: await mwSearchRelatedDesigns(s, type, keyword) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // POST /api/v1/makerworld/web/refresh — refresh the access token via the refreshToken
    // in the supplied cookie (extends a ~24h session toward the ~90d refresh window).
    if (path === '/api/v1/makerworld/web/refresh' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      try { const r = await mwRefreshToken(s); return r ? json({ ok: true, refreshed: true, token: r.token ? 'present' : 'absent' }) : json({ ok: false, error: 'no_refresh_token', hint: 'Include refreshToken in X-MW-Cookie.' }, { status: 400 }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // POST /api/v1/makerworld/web/laser-cut/publish — Laser & Cut models (separate product;
    // draft2d endpoints). JSON LaserCutPublishInput (+ draftOnly). Files uploaded via /upload.
    if (path === '/api/v1/makerworld/web/laser-cut/publish' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      let input: LaserCutPublishInput & { draftOnly?: boolean };
      try { input = await req.json() as LaserCutPublishInput & { draftOnly?: boolean }; } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!input?.title || !input?.modelFiles?.length) return json({ error: 'missing_fields', hint: 'Need title + modelFiles[] (.lac/.svg/.dxf).' }, { status: 400 });
      let lcId = 0;
      try {
        lcId = await mwCreateLaserCutDraft(s, input);
        if (input.draftOnly) return json({ ok: true, id: lcId, status: 'draft', kind: 'laser-cut' });
        await mwPublishLaserCut(s, lcId, input);
        return json({ ok: true, id: lcId, status: 'verifying', kind: 'laser-cut' });
      } catch (err) {
        let cleanedUp = false;
        if (lcId) { try { await mwDeleteLaserCut(s, lcId); cleanedUp = true; } catch { /* best effort */ } }
        return json({ error: 'mw_publish_failed', message: err instanceof Error ? err.message : String(err), draftId: lcId || undefined, cleanedUp }, { status: 502 });
      }
    }

    // POST /api/v1/makerworld/web/laser-cut/delete — JSON { id }.
    if (path === '/api/v1/makerworld/web/laser-cut/delete' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      let id = 0; try { id = ((await req.json()) as { id?: number }).id ?? 0; } catch { /* */ }
      if (!id) return json({ error: 'missing_id' }, { status: 400 });
      try { await mwDeleteLaserCut(s, id); return json({ ok: true, id, deleted: true, kind: 'laser-cut' }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
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
