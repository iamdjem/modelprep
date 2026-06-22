// Cloudflare bindings injected at runtime. Secrets come from .dev.vars locally
// and `wrangler secret put` in production — never from [vars] in wrangler.toml.
export interface Env {
  CULTS_USERNAME: string;
  CULTS_API_KEY: string;
  // Cults login email + password for the WEB upload flow (separate from the
  // API key above, which only the GraphQL flow uses). Set via
  // `wrangler secret put CULTS_EMAIL` / `CULTS_PASSWORD` in production,
  // or .dev.vars locally. Optional — browser sends per-request via
  // X-Cults-Email / X-Cults-Password headers; the env vars are the fallback
  // for curl tests.
  CULTS_EMAIL?: string;
  CULTS_PASSWORD?: string;
  STAGING: R2Bucket;            // bound from [[r2_buckets]] in wrangler.toml
  // TOKENS?: KVNamespace;      // enable when KV namespace is bound
  // Anthropic API key for AI listing generation (vision over the user's photos).
  // Set via `wrangler secret put ANTHROPIC_API_KEY`. Optional — when absent, the
  // /api/v1/ai/generate-listing route returns 503 and the frontend falls back to
  // its on-device heuristic.
  ANTHROPIC_API_KEY?: string;
}

// Payload that the React frontend will eventually POST to /publish/cults3d.
// Mirrors a subset of the Cults `createCreation` mutation signature, kept
// platform-neutral on our side so the same shape can later target MMF/Thingiverse.
export interface PublishPayload {
  title: string;
  description: string;
  coverImageUrl: string;             // ABSOLUTE https URL Cults can fetch
  galleryImageUrls?: string[];
  modelFileUrls: string[];           // ABSOLUTE https URLs
  categoryId: string;                // Cults Relay base64 id (e.g. Q2F0ZWdvcnkvMjM=)
  subCategoryIds?: string[];
  locale?: 'EN' | 'FR' | 'DE' | 'ES' | 'IT' | 'JA' | 'ZH';
  // Optional pricing. Omit both for a free creation.
  downloadPrice?: number;
  currency?: 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD' | 'AUD' | 'JPY';
  licenseCode?: string;              // see /cults3d/licenses for valid codes
  metaTags?: string[];               // Cults validates each tag against an internal dictionary; unknown tags come back as errors
}
