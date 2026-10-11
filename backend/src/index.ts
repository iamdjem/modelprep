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
  cultsWebReadCreation,
  cultsWebReadbackIssues,
  cultsWebIllustrationValidationIssue,
  cultsWebFilenameValidationIssue,
} from './adapters/cults3d-web';
import {
  mwCheckSession,
  mwLogin,
  mwLoginWithCode,
  mwPresignUpload,
  mwUploadFile,
  mwCreateDraft,
  mwPublish,
  mwDelete,
  mwListMyDesigns,
  mwDraftStatus,
  mwSuggestTags,
  mwFetchCatalogStandalone,
  mwSearchRelatedDesigns,
  mwWhoami,
  mwUploadCapabilities,
  mwRefreshToken,
  mwCreateLaserCutDraft,
  mwPublishLaserCut,
  mwDeleteLaserCut,
  mwLaserCutDraftStatus,
  type MakerWorldSession,
  type MakerWorldPublishInput,
  type BomCatalog,
  type LaserCutPublishInput,
} from './adapters/makerworld-web';
import { resolveMakerWorldRemix, validateLaserCutPublish, validateMakerWorldPublish } from './makerworld-validation';
import { allowMakerWorldLogin } from './makerworld-auth';
import {
  printablesDeleteModel,
  printablesFinishUpload,
  printablesListMyModels,
  printablesMeta,
  printablesModelStatus,
  printablesPollUploads,
  printablesPresignUpload,
  printablesRequestPublish,
  printablesResolveRemix,
  printablesUpdateModel,
  printablesWhoami,
  validatePrintablesUploadRequest,
  type PrintablesModelUpdateInput,
  type PrintablesSession,
  type PrintablesUploadRequest,
} from './adapters/printables-web';
import { PRINTABLES_META_SNAPSHOT } from './adapters/printables-meta-snapshot';
import { stageFile, serveFile } from './r2';
import { generateListing, generateListingOpenAICompat, OPENAI_COMPAT_BASE, type ListingImage } from './adapters/ai-listing';
import type { PublishPayload } from './types';

// Bytes — cap upload size at the Worker request-body limit. Cloudflare's
// default for Workers Free / Paid is 100 MB; we cap at 95 MB so the JSON
// response can fit in the remaining headroom.
const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;
const MAX_MW_DIRECT_UPLOAD_BYTES = 200 * 1024 * 1024;

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cults-Username, X-Cults-Api-Key, X-Cults-Email, X-Cults-Password, X-MW-Cookie, X-Printables-Cookie',
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
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
    // Cults-direct identifiers are accepted when valid; platform-neutral
    // category/license values are mapped only when an exact mapping exists.
    // Missing, unknown, and price-incompatible values fail before the external
    // create call rather than silently falling back to a different contract.
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
      const resolvedCategory = resolveCultsCategory(body.categoryId || body.category);
      if (!resolvedCategory) {
        return json({
          error: 'invalid_category',
          hint: 'Choose an explicit supported Cults3D category before publishing.',
        }, { status: 400 });
      }
      const categoryId = resolvedCategory.categoryId;

      // ---- License (enforces free/paid compatibility) ----------------------
      const resolvedLicense = resolveCultsLicense(body.licenseCode || body.license, isPaid);
      if (!resolvedLicense) {
        return json({
          error: 'invalid_license',
          hint: `Choose a Cults3D license that is valid for a ${isPaid ? 'paid' : 'free'} listing before publishing.`,
        }, { status: 400 });
      }
      const licenseCode = resolvedLicense.licenseCode;

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

        // Category: accept a known integer ID or an exactly mapped ModelPrep
        // label. Never silently file an unknown choice under "Various".
        const resolvedCategory = resolveCultsCategoryInt(str('categoryId') || str('category'));
        if (!resolvedCategory) {
          return json({
            error: 'invalid_category',
            hint: 'Choose an explicit supported Cults3D category before uploading files.',
          }, { status: 400 });
        }
        const categoryId = resolvedCategory.categoryId;

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

        const cultsMetaTags = new Set([
          'articulated', 'customizable', 'functional_part', 'hollow_model', 'multicolor', 'multi_material',
          'no_support', 'print_in_place', 'remix', 'resin_print', 'scale_model', 'scan',
        ]);
        let metaTags: string[] = [];
        const metaTagsRaw = str('metaTags');
        if (metaTagsRaw) {
          try {
            const parsed = JSON.parse(metaTagsRaw);
            if (!Array.isArray(parsed)) throw new Error('not an array');
            metaTags = parsed.map(String);
          } catch {
            return json({ error: 'invalid_meta_tags', hint: 'Cults3D meta tags must be a JSON array.' }, { status: 400 });
          }
        } else {
          metaTags = form.getAll('metaTag').filter(v => typeof v === 'string').map(String);
        }
        if (metaTags.some(tag => !cultsMetaTags.has(tag))) {
          return json({ error: 'invalid_meta_tags', hint: 'Cults3D received an unknown meta tag.' }, { status: 400 });
        }

        // Pricing: Cults's actual enum values are 'free' / 'priced' / 'open_priced'
        // (NOT 'paid' / 'open' — those get "Pricing isn't included in the list").
        // The frontend sends platform-neutral `{free, price}`; we derive.
        const rawPricing = str('pricing');
        const normalizedPricing = rawPricing === 'paid' ? 'priced' : rawPricing === 'open' ? 'open_priced' : rawPricing;
        const explicitFree = normalizedPricing ? normalizedPricing === 'free' : str('free') === 'true' || str('price') === '0';
        const priceNum = Number(str('downloadPrice') || str('price'));
        const isPaid = normalizedPricing === 'priced' || normalizedPricing === 'open_priced' || (!explicitFree && Number.isFinite(priceNum) && priceNum > 0);
        // Allow caller to send Cults-direct `pricing` too (for power users /
        // curl), but normalize legacy 'paid'/'open' aliases just in case.
        const pricing = (
          normalizedPricing || (isPaid ? 'priced' : 'free')
        ) as 'free' | 'priced' | 'open_priced';
        const downloadPrice = isPaid ? priceNum : 0;
        const downloadOpenPrice = Number(str('downloadOpenPrice')) || 0;
        const currency = str('currency') || 'USD';

        // License: accept a known direct code or an exactly mapped ModelPrep
        // value, while enforcing Cults's free/paid compatibility rules.
        const resolvedLicense = resolveCultsLicense(str('licenseType') || str('license'), isPaid);
        if (!resolvedLicense) {
          return json({
            error: 'invalid_license',
            hint: `Choose a Cults3D license that is valid for a ${isPaid ? 'paid' : 'free'} listing before uploading files.`,
          }, { status: 400 });
        }
        const licenseType = resolvedLicense.licenseCode;

        const visibility = (str('visibility') || 'secret') as 'public' | 'secret' | 'offline';

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
        const illustrationIssue = cultsWebIllustrationValidationIssue(illustrations);
        if (illustrationIssue) {
          return json({ error: 'invalid_illustrations', hint: illustrationIssue }, { status: 400 });
        }
        const filenameIssue = cultsWebFilenameValidationIssue([...models, ...illustrations]);
        if (filenameIssue) {
          return json({ error: 'invalid_filename', hint: filenameIssue }, { status: 400 });
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
          metaTags,
          flatKeywords,
          blueprintIds,
          illustrationIds,
          madeWithAi: str('madeWithAi') === 'true',
          showComments: str('showComments') !== 'false',
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

        // ---- Step 5: persisted edit/list readback ----
        // A successful publish redirect proves only submission. Retain the
        // receipt even if readback fails, but mark it uncertified so the UI
        // cannot report a video/media branch as complete without persistence.
        let readback = null;
        let readbackIssues: string[] = [];
        try {
          readback = await cultsWebReadCreation(session, slug);
          readbackIssues = cultsWebReadbackIssues({
            title: name,
            visibility,
            blueprintIds,
            blueprintFilenames: models.map((file) => file.name || 'model.stl'),
            illustrationIds,
            illustrationFilenames: illustrations.map((file) => file.name || 'cover.jpg'),
          }, readback);
        } catch (readbackErr) {
          readbackIssues = [`Cults persisted readback failed: ${readbackErr instanceof Error ? readbackErr.message : String(readbackErr)}`];
        }

        console.log('[web-publish] done →', designUrl, 'substituted:', substituted);
        return json({
          ok: true,
          slug,
          designUrl,
          blueprintIds,
          illustrationIds,
          readback,
          readbackIssues,
          substituted,
          payload: { name, description, categoryId, currency, pricing, downloadPrice, licenseType, visibility, flatKeywords, metaTags, madeWithAi: str('madeWithAi') === 'true', showComments: str('showComments') !== 'false' },
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
    // Auth = the user's MakerWorld token/session, forwarded as the full Cookie
    // header value in `X-MW-Cookie` (minimally `token=…`; refreshToken recommended).
    // The Worker login routes obtain it directly; browser-session/paste is a fallback.
    const getMwSession = (): MakerWorldSession | null => {
      const cookie = req.headers.get('X-MW-Cookie');
      return cookie ? { cookie } : null;
    };
    const mwAuthError = () =>
      json({ error: 'missing_makerworld_session', hint: 'Send X-MW-Cookie with your MakerWorld session (at minimum token=…).' }, { status: 401 });

    // POST /api/v1/makerworld/web/login {account, password} — real email/password sign-in.
    // The Worker (server-side, no CORS/cf_clearance constraint) exchanges credentials for a
    // 180-day token via MakerWorld's login API, and returns it as the `cookie` string the
    // rest of the app uses as the account secret. The password is exchanged, never stored.
    // Step 1 — POST {account, password}. Returns {ok:true, cookie} on success, or
    // {ok:false, needCode:true} when MakerWorld emails a verification code (new-IP MFA).
    if (path === '/api/v1/makerworld/web/login' && req.method === 'POST') {
      let body: { account?: string; password?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!body.account || !body.password) return json({ error: 'missing_credentials', hint: 'Send {account, password}.' }, { status: 400 });
      if (!(await allowMakerWorldLogin(env, body.account))) {
        return json({ ok: false, error: 'Too many sign-in attempts. Wait a minute or use the MakerWorld window.' }, { status: 429 });
      }
      try {
        const r = await mwLogin(body.account, body.password);
        if (!r.ok) return json({ ok: false, needCode: true, ...(r.tfaKey ? { tfaKey: r.tfaKey } : {}) });
        const cookie = `token=${r.token}` + (r.refreshToken ? `; refreshToken=${r.refreshToken}` : '');
        return json({ ok: true, cookie, userId: r.userId, expireIn: r.expireIn });
      } catch (err) {
        return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 401 });
      }
    }

    // Step 2 — POST {account, code} to complete sign-in with the emailed verification code.
    if (path === '/api/v1/makerworld/web/login-code' && req.method === 'POST') {
      let body: { account?: string; code?: string; tfaKey?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!body.account || !body.code) return json({ error: 'missing_code', hint: 'Send {account, code}.' }, { status: 400 });
      if (!(await allowMakerWorldLogin(env, body.account))) {
        return json({ ok: false, error: 'Too many verification attempts. Wait a minute or use the MakerWorld window.' }, { status: 429 });
      }
      try {
        const r = await mwLoginWithCode(body.account, body.code, body.tfaKey);
        if (!r.ok) return json({ ok: false, error: 'Code not accepted — check it and try again.' }, { status: 401 });
        const cookie = `token=${r.token}` + (r.refreshToken ? `; refreshToken=${r.refreshToken}` : '');
        return json({ ok: true, cookie, userId: r.userId, expireIn: r.expireIn });
      } catch (err) {
        return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 401 });
      }
    }

    // GET /api/v1/makerworld/web/check — is the supplied cookie a valid session?
    if (path === '/api/v1/makerworld/web/check' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      try { return json({ ok: await mwCheckSession(s) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/whoami — the signed-in user's profile (handle/name) for labelling.
    if (path === '/api/v1/makerworld/web/whoami' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      try { const me = await mwWhoami(s); return json({ ok: !!me, ...(me || {}) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/capabilities — account-specific upload flags.
    // In particular, MakerWorld hides CyberBrick unless userInfo.rcUpload is true.
    if (path === '/api/v1/makerworld/web/capabilities' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      try { return json({ ok: true, ...(await mwUploadCapabilities(s)) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/my-creations — list my published designs.
    if (path === '/api/v1/makerworld/web/my-creations' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      try { return json({ ok: true, designs: await mwListMyDesigns(s) }); }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/draft-status?id=<draftId> — post-submit slicing result.
    // resultType != 0 ⇒ failed (with a human reason); == 0 ⇒ verifying or published.
    if (path === '/api/v1/makerworld/web/draft-status' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'missing_id' }, { status: 400 });
      try {
        const st = await mwDraftStatus(s, id);
        if (!st) return json({ ok: false, error: 'not_found' }, { status: 404 });
        return json({ ok: true, ...st });
      } catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
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

    // POST /api/v1/makerworld/web/upload/presign — JSON {fileName,size,useType?}.
    // Returns MakerWorld's short-lived S3 PUT URL so the browser can upload bytes
    // directly. This preserves MakerWorld's 150/200 MB limits without crossing
    // Cloudflare's 100 MB Worker request-body ceiling.
    if (path === '/api/v1/makerworld/web/upload/presign' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      let body: { fileName?: string; size?: number; useType?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      const fileName = body.fileName?.trim() ?? '';
      const size = Number(body.size ?? 0);
      if (!fileName) return json({ error: 'missing_file_name' }, { status: 400 });
      if (!Number.isFinite(size) || size < 0) return json({ error: 'invalid_file_size' }, { status: 400 });
      const useType = body.useType || 'makerworld/model';
      if (useType !== 'makerworld/model') return json({ error: 'invalid_use_type' }, { status: 400 });
      const maxBytes = /\.3mf$/i.test(fileName) ? 150 * 1024 * 1024 : MAX_MW_DIRECT_UPLOAD_BYTES;
      if (size > maxBytes) return json({ error: 'file_too_large', maxBytes, gotBytes: size }, { status: 413 });
      try {
        const presigned = await mwPresignUpload(s, fileName, useType);
        return json({ ok: true, size, ...presigned });
      } catch (err) {
        return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 });
      }
    }

    // POST /api/v1/makerworld/web/upload — multipart `file` (+ optional `useType`,
    // `fileName`). Compatibility proxy for files below the Worker body ceiling;
    // new clients use /upload/presign + a direct S3 PUT.
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
        if (useType !== 'makerworld/model') return json({ error: 'invalid_use_type' }, { status: 400 });
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
      const validationErrors = input.draftOnly
        ? [!input?.title?.trim() ? 'title is required' : '', !input?.coverUrl ? 'coverUrl is required' : ''].filter(Boolean)
        : validateMakerWorldPublish(input);
      try { validationErrors.push(...await resolveMakerWorldRemix(s, input)); }
      catch (err) { return json({ error: 'remix_lookup_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
      if (input.cyberBrick) {
        try {
          const capabilities = await mwUploadCapabilities(s);
          if (!capabilities.rcUpload) validationErrors.push('CyberBrick upload is not enabled for this MakerWorld account');
        } catch (err) {
          return json({ error: 'capability_check_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 });
        }
      }
      if (validationErrors.length) return json({ error: 'invalid_publish', issues: validationErrors }, { status: 400 });
      let createdId = 0;
      try {
        createdId = await mwCreateDraft(s, input);
        if (input.draftOnly) return json({ ok: true, id: createdId, status: 'draft', url: `https://makerworld.com/en/my/models/drafts/${createdId}/edit` });
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
      try {
        const r = await mwRefreshToken(s);
        if (!r) return json({ ok: false, error: 'no_refresh_token', hint: 'Include refreshToken in X-MW-Cookie.' }, { status: 400 });
        const existingRefresh = /(?:^|;\s*)refreshToken=([^;]+)/.exec(s.cookie)?.[1];
        const refreshToken = r.refreshToken || existingRefresh;
        const cookie = `token=${r.token}` + (refreshToken ? `; refreshToken=${refreshToken}` : '');
        return json({ ok: true, refreshed: true, cookie, expiresIn: r.expiresIn });
      }
      catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // GET /api/v1/makerworld/web/laser-cut/draft-status?id=<draftId> — the
    // Laser & Cut counterpart to the regular post-submit result check.
    if (path === '/api/v1/makerworld/web/laser-cut/draft-status' && req.method === 'GET') {
      const s = getMwSession(); if (!s) return mwAuthError();
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'missing_id' }, { status: 400 });
      try {
        const status = await mwLaserCutDraftStatus(s, id);
        if (!status) return json({ ok: false, error: 'not_found' }, { status: 404 });
        return json({ ok: true, ...status });
      } catch (err) { return json({ error: 'mw_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
    }

    // POST /api/v1/makerworld/web/laser-cut/publish — Laser & Cut models (separate product;
    // draft2d endpoints). JSON LaserCutPublishInput (+ draftOnly). Files uploaded via /upload.
    if (path === '/api/v1/makerworld/web/laser-cut/publish' && req.method === 'POST') {
      const s = getMwSession(); if (!s) return mwAuthError();
      let input: LaserCutPublishInput & { draftOnly?: boolean };
      try { input = await req.json() as LaserCutPublishInput & { draftOnly?: boolean }; } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      const validationErrors = input.draftOnly
        ? [!input?.title?.trim() ? 'title is required' : '', !input?.lacFile && !input?.modelFiles?.length ? 'a .lac or raw model file is required' : ''].filter(Boolean)
        : validateLaserCutPublish(input);
      try { validationErrors.push(...await resolveMakerWorldRemix(s, input)); }
      catch (err) { return json({ error: 'remix_lookup_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
      if (input.cyberBrick) {
        try {
          const capabilities = await mwUploadCapabilities(s);
          if (!capabilities.rcUpload) validationErrors.push('CyberBrick upload is not enabled for this MakerWorld account');
        } catch (err) {
          return json({ error: 'capability_check_failed', message: err instanceof Error ? err.message : String(err) }, { status: 502 });
        }
      }
      if (validationErrors.length) return json({ error: 'invalid_publish', issues: validationErrors }, { status: 400 });
      let lcId = 0;
      try {
        lcId = await mwCreateLaserCutDraft(s, input);
        if (input.draftOnly) return json({ ok: true, id: lcId, status: 'draft', kind: 'laser-cut', url: `https://makerworld.com/en/my/laser-and-cut-models/drafts/${lcId}/edit` });
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

    // ==================== Printables WEB flow ============================
    // Printables' create form uses first-party GraphQL plus direct presigned
    // uploads. The Electron main process owns the browser session and adds the
    // cookie here; the renderer stores only an opaque account marker.
    const getPrintablesSession = (): PrintablesSession | null => {
      const cookie = req.headers.get('X-Printables-Cookie');
      return cookie ? { cookie } : null;
    };
    const printablesAuthError = () =>
      json({
        error: 'missing_printables_session',
        hint: 'Connect Printables in the desktop app and retry.',
      }, { status: 401 });
    const printablesFailed = (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[printables] upstream request failed:', message);
      return json({
        error: 'printables_failed',
        message,
      }, { status: 502 });
    };

    // Public, read-only taxonomy used by the options UI.
    if (path === '/api/v1/printables/meta' && req.method === 'GET') {
      // Printables rate-limits its public GraphQL endpoint. Cache only the
      // origin-independent JSON payload, then reconstruct the response through
      // makeJson() so the requesting origin receives the correct CORS headers.
      const cacheKey = new Request(`${url.origin}/__modelprep-cache/printables-meta-v1`);
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        const data = await cached.json();
        return json(data, {
          headers: {
            'Cache-Control': cached.headers.get('Cache-Control')
              ?? 'public, max-age=300, s-maxage=86400',
            'X-ModelPrep-Cache': data && typeof data === 'object' && 'metaSource' in data
              ? 'SNAPSHOT-HIT'
              : 'HIT',
          },
        });
      }
      try {
        const data = { ok: true, ...(await printablesMeta()) };
        const cacheResponse = new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=86400',
          },
        });
        ctx.waitUntil(caches.default.put(cacheKey, cacheResponse));
        return json(data, {
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=86400',
            'X-ModelPrep-Cache': 'MISS',
          },
        });
      } catch (err) {
        const data = {
          ok: true,
          ...PRINTABLES_META_SNAPSHOT,
          metaSource: 'snapshot',
          metaWarning: err instanceof Error ? err.message : String(err),
        };
        const cacheResponse = new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300, s-maxage=3600',
          },
        });
        ctx.waitUntil(caches.default.put(cacheKey, cacheResponse));
        return json(data, {
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=3600',
            'X-ModelPrep-Cache': 'SNAPSHOT',
          },
        });
      }
    }

    if (path === '/api/v1/printables/web/check' && req.method === 'GET') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      try {
        const user = await printablesWhoami(s);
        return json({ ok: !!user, user });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/whoami' && req.method === 'GET') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      try {
        const user = await printablesWhoami(s);
        if (!user) return json({ ok: false, error: 'not_authenticated' }, { status: 401 });
        return json({ ok: true, ...user });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/upload/presign' && req.method === 'POST') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      let body: PrintablesUploadRequest & { size?: number };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      const issues = validatePrintablesUploadRequest(body, body.size);
      if (issues.length) return json({ error: 'invalid_upload', issues }, { status: 400 });
      try {
        const upload = await printablesPresignUpload(s, body);
        if (!upload.ok || !upload.fileUpload?.id || !upload.uploadData?.url) {
          return json({ error: 'printables_upload_rejected', issues: upload.errors }, { status: 400 });
        }
        return json({ ...upload, ok: true });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/upload/finish' && req.method === 'POST') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      let body: { fileUploadId?: string; crc32c?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!body.fileUploadId) return json({ error: 'missing_file_upload_id' }, { status: 400 });
      try {
        const finished = await printablesFinishUpload(s, body.fileUploadId, body.crc32c);
        if (!finished.ok) return json({ error: 'printables_finish_rejected', issues: finished.errors }, { status: 400 });
        return json({ ...finished, ok: true });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/upload/status' && req.method === 'POST') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      let body: { ids?: string[] };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      const ids = (body.ids ?? []).filter((id) => typeof id === 'string' && id);
      if (!ids.length) return json({ error: 'missing_ids' }, { status: 400 });
      try { return json({ ok: true, ...(await printablesPollUploads(s, ids)) }); }
      catch (err) { return printablesFailed(err); }
    }

    // Save a partial draft (draft:true), or save the complete public-ready
    // metadata (draft:false). Publishing itself remains a separate explicit
    // action below because some accounts require approval.
    if (path === '/api/v1/printables/web/model' && req.method === 'POST') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      let body: PrintablesModelUpdateInput;
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      try {
        const updated = await printablesUpdateModel(s, body);
        if (!updated.ok || !updated.output?.id) {
          return json({ error: 'printables_model_rejected', issues: updated.errors }, { status: 400 });
        }
        return json({ ...updated, ok: true });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/publish' && req.method === 'POST') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      let body: { id?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!body.id) return json({ error: 'missing_id' }, { status: 400 });
      try {
        const published = await printablesRequestPublish(s, body.id);
        if (!published.ok) return json({ error: 'printables_publish_rejected', issues: published.errors }, { status: 400 });
        return json({ ...published, ok: true });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/status' && req.method === 'GET') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'missing_id' }, { status: 400 });
      try {
        const model = await printablesModelStatus(s, id);
        if (!model) return json({ ok: false, error: 'not_found' }, { status: 404 });
        const state = model.datePublished
          ? 'live'
          : model.publishRequests?.some((request) => /pending|requested/i.test(request.status))
            ? 'pending'
            : 'draft';
        return json({ ok: true, state, model });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/my-models' && req.method === 'GET') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      try {
        const models = await printablesListMyModels(s);
        return json({
          ok: true,
          drafts: models.drafts,
          published: models.published.items,
          cursor: models.published.cursor ?? null,
        });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/delete' && req.method === 'POST') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      let body: { id?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!body.id) return json({ error: 'missing_id' }, { status: 400 });
      try {
        const deleted = await printablesDeleteModel(s, body.id);
        if (!deleted.ok) return json({ error: 'printables_delete_rejected', issues: deleted.errors }, { status: 400 });
        return json({ ok: true, id: body.id, deleted: true });
      } catch (err) { return printablesFailed(err); }
    }

    if (path === '/api/v1/printables/web/remix/resolve' && req.method === 'POST') {
      const s = getPrintablesSession(); if (!s) return printablesAuthError();
      let body: { value?: string };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      if (!body.value?.trim()) return json({ error: 'missing_value' }, { status: 400 });
      try { return json({ ok: true, ...(await printablesResolveRemix(s, body.value.trim())) }); }
      catch (err) { return printablesFailed(err); }
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

    // -------------------- AI: generate a listing from photos ---------------
    // POST { provider, apiKey?, model?, baseUrl?, images:[{base64,mediaType}], hint?,
    //        categories:string[], limits? } → { title, description, tags, category,
    //        realPhotoDetected, notes }. The user brings their OWN key — it is used for
    //        this one request and never stored. Providers: any OpenAI-compatible host
    //        (openrouter/gemini/groq/openai/deepseek/custom), or `anthropic-server` which
    //        uses our env key if configured. 503 when nothing is usable → frontend falls
    //        back to its offline heuristic. (Local Ollama is called direct from the browser.)
    if (path === '/api/v1/ai/generate-listing' && req.method === 'POST') {
      let body: { provider?: string; apiKey?: string; model?: string; baseUrl?: string; images?: ListingImage[]; hint?: string; categories?: string[]; limits?: Record<string, number> };
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, { status: 400 }); }
      const images = (body.images ?? []).filter((i) => i && i.base64 && i.mediaType);
      if (!images.length) return json({ error: 'no_images', hint: 'Send at least one photo as {base64, mediaType}.' }, { status: 400 });
      const input = { images, hint: body.hint, categories: body.categories ?? [], limits: body.limits };
      const provider = (body.provider ?? '').toLowerCase();
      const isOpenAICompat = !!OPENAI_COMPAT_BASE[provider] || (provider === 'custom' && !!body.baseUrl);
      try {
        let listing;
        if (isOpenAICompat) {
          const baseUrl = provider === 'custom' ? String(body.baseUrl) : OPENAI_COMPAT_BASE[provider];
          const apiKey = String(body.apiKey ?? '');
          const model = String(body.model ?? '');
          if (!apiKey) return json({ error: 'missing_key', hint: 'This provider needs your API key.' }, { status: 400 });
          if (!model) return json({ error: 'missing_model', hint: 'Choose a model (e.g. a free vision model).' }, { status: 400 });
          listing = await generateListingOpenAICompat({ baseUrl, apiKey, model, input });
        } else if (provider === 'anthropic') {
          // Claude with the maker's own key, over the native Messages API rather than the
          // OpenAI-compatible shim — photos go as proper base64 image blocks.
          const apiKey = String(body.apiKey ?? '');
          if (!apiKey) return json({ error: 'missing_key', hint: 'This provider needs your API key.' }, { status: 400 });
          listing = await generateListing(apiKey, input, body.model);
        } else if (provider === 'anthropic-server' && env.ANTHROPIC_API_KEY) {
          listing = await generateListing(env.ANTHROPIC_API_KEY, input);
        } else {
          return json({ error: 'ai_not_configured', hint: 'Pick an AI provider and add your key in AI settings.' }, { status: 503 });
        }
        return json({ ok: true, ...listing });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log('[ai] generate-listing failed:', message);
        return json({ error: 'ai_failed', message }, { status: 502 });
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
