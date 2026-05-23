// Cloudflare bindings injected at runtime. Secrets come from .dev.vars locally
// and `wrangler secret put` in production — never from [vars] in wrangler.toml.
export interface Env {
  CULTS_USERNAME: string;
  CULTS_API_KEY: string;
  STAGING: R2Bucket;            // bound from [[r2_buckets]] in wrangler.toml
  // TOKENS?: KVNamespace;      // enable when KV namespace is bound
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
