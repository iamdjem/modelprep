// Translation tables from ModelPrep's platform-agnostic vocabulary to
// Cults3D's specific identifiers. Kept separate from cults3d.ts so it's easy
// to swap when adding MakerWorld/Thingiverse — each platform will get its own
// `*-mappings.ts` with the same exported shapes.
//
// Source of truth for the right-hand side:
// - GET /api/v1/cults3d/categories  (Cults's `categories` query)
// - GET /api/v1/cults3d/licenses    (Cults's `licenses` query)
// Re-run those if Cults adds/changes categories or license codes; update here.

/** ModelPrep's CATEGORIES strings (frontend constant) → Cults Relay category ID.
 *  Cults has fewer, broader categories than ModelPrep, so some entries collapse
 *  to a best-fit parent (e.g. "Outdoor & Garden" → Various, "Cosplay & Props"
 *  → Fashion because Cults files cosplay under Fashion as a subcategory). */
export const CULTS_CATEGORY_MAP: Record<string, string> = {
  'Home & Living':          'Q2F0ZWdvcnkvMzA', // Home
  'Tools':                  'Q2F0ZWdvcnkvMjc', // Tool
  'Toys & Games':           'Q2F0ZWdvcnkvMzE', // Game
  'Hobby & DIY':            'Q2F0ZWdvcnkvMjk', // Various
  'Art & Decor':            'Q2F0ZWdvcnkvMjM', // Art
  'Fashion & Jewelry':      'Q2F0ZWdvcnkvMjQ', // Fashion (Jewelry is separate but Fashion is the broader bucket)
  'Electronics & Tech':     'Q2F0ZWdvcnkvMjU', // Gadget
  'Outdoor & Garden':       'Q2F0ZWdvcnkvMjk', // Various
  'Educational':            'Q2F0ZWdvcnkvMjk', // Various
  'Miniatures & Tabletop':  'Q2F0ZWdvcnkvMzE', // Game
  'Cosplay & Props':        'Q2F0ZWdvcnkvMjQ', // Fashion (cosplay-props is a Fashion subcategory on Cults)
  'Holiday & Seasonal':     'Q2F0ZWdvcnkvMjk', // Various
  'Other':                  'Q2F0ZWdvcnkvMjk', // Various
};

/** Legacy catch-all identifier retained for compatibility with old fixtures.
 *  Strict resolvers below never select it implicitly. */
export const CULTS_DEFAULT_CATEGORY_ID = 'Q2F0ZWdvcnkvMjk'; // Various

/** ModelPrep license id (lowercase, no separators) → Cults licenseCode.
 *  Cults imposes free/paid restrictions on licenses (CC = free-only,
 *  cults_cu = paid-only). Use {@link resolveCultsLicense} which enforces
 *  those rules and rejects missing, unknown, or incompatible choices. */
export const CULTS_LICENSE_MAP: Record<string, string> = {
  cc0:       'cc_pddc',     // CC0 - Creative Commons public domain
  ccby:      'cc_by',       // CC BY - Attribution
  ccbysa:    'cc_by_sa',    // CC BY-SA
  ccbync:    'cc_by_nc',    // CC BY-NC
  ccbyncsa:  'cc_by_nc_sa', // CC BY-NC-SA
  ccbynd:    'cc_by_nd',    // CC BY-ND
  standard:  'cults_cu',    // CULTS CU - Commercial Use (paid-only)
};

/** Which Cults licenses are valid on free creations / on paid creations.
 *  Mirrors `availableOnFreeDesigns` / `availableOnPricedDesigns` from the
 *  Cults `licenses` query. */
const LICENSE_RULES: Record<string, { free: boolean; paid: boolean }> = {
  cults_pu:    { free: true,  paid: true  },
  cults_cu:    { free: false, paid: true  },
  cults_cu_nd: { free: false, paid: true  },
  cc_by:       { free: true,  paid: false },
  cc_by_sa:    { free: true,  paid: false },
  cc_by_nd:    { free: true,  paid: false },
  cc_by_nc:    { free: true,  paid: false },
  cc_by_nc_sa: { free: true,  paid: false },
  cc_by_nc_nd: { free: true,  paid: false },
  cc_pddc:     { free: true,  paid: false },
  cern_ohl:    { free: true,  paid: false },
  gpl:         { free: true,  paid: false },
  lgpl:        { free: true,  paid: false },
  mit:         { free: true,  paid: false },
};

/** Resolve either a ModelPrep category label or an explicit Cults Relay ID.
 *  Missing and unknown values fail closed so publishing never silently moves
 *  a creation into Cults's "Various" category. */
export function resolveCultsCategory(modelprepCategory?: string): {
  categoryId: string;
  substituted: boolean;
} | null {
  const requested = String(modelprepCategory || '').trim();
  if (!requested) return null;
  const mapped = CULTS_CATEGORY_MAP[requested];
  if (mapped) return { categoryId: mapped, substituted: false };
  if (new Set(Object.values(CULTS_CATEGORY_MAP)).has(requested)) {
    return { categoryId: requested, substituted: false };
  }
  return null;
}

/** Web flow uses INTEGER category IDs (`category_id=25`) in its form POSTs,
 *  not Relay base64 IDs. The Relay ID is just `Category/<int>` base64-encoded,
 *  so we decode + strip to get the integer the web form wants. */
export function relayCategoryToInt(relayId: string): number {
  // atob is a global in Workers + browsers.
  const decoded = atob(relayId);                  // e.g. "Category/25"
  const n = Number(decoded.split('/').pop());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`relayCategoryToInt: bad decoded id ${decoded}`);
  }
  return n;
}

/** Web-flow variant of resolveCultsCategory: returns the integer ID. */
export function resolveCultsCategoryInt(modelprepCategory?: string): {
  categoryId: number;
  substituted: boolean;
} | null {
  const requested = String(modelprepCategory || '').trim();
  const direct = Number(requested);
  const validIds = new Set(Object.values(CULTS_CATEGORY_MAP).map(relayCategoryToInt));
  if (Number.isInteger(direct) && validIds.has(direct)) {
    return { categoryId: direct, substituted: false };
  }
  const r = resolveCultsCategory(modelprepCategory);
  if (!r) return null;
  return { categoryId: relayCategoryToInt(r.categoryId), substituted: r.substituted };
}

/** Resolve either a ModelPrep license id or a direct Cults license code while
 *  enforcing free/paid compatibility. Missing, unknown, and incompatible
 *  choices fail closed instead of being replaced with a Cults default. */
export function resolveCultsLicense(
  modelprepLicense: string | undefined,
  isPaid: boolean,
): { licenseCode: string; substituted: boolean } | null {
  const value = String(modelprepLicense || '').trim();
  const requested = LICENSE_RULES[value] ? value : CULTS_LICENSE_MAP[value];
  if (!requested) return null;
  const rules = LICENSE_RULES[requested];
  if (!rules) return null;

  const compatible = isPaid ? rules.paid : rules.free;
  if (compatible) return { licenseCode: requested, substituted: false };
  return null;
}
