// Remembered per-platform settings.
//
// A creator who publishes the same kind of model answers the same questions
// on every platform every time: licence, visibility, print method, the
// attestation checkboxes, the contest they never enter. "Remember these
// settings" stores a platform's current answers and a new project starts
// with them. Anything that points at this project's files or pictures, or at
// another model (a remix source), is left out: it would be wrong on the next
// project by definition.

export const PLATFORM_DEFAULTS_KEY = 'modelprep:platform-option-defaults:v1';

// Explicitly list the answers that are safe to carry to another project.
// The previous substring filter missed project IDs, summaries, BOM rows,
// schedules and recovery drafts. It also dropped legitimate preferences such
// as includePrintProfile merely because the key contained "file". Unknown
// fields now stay project-local by default.
export const REMEMBERABLE_FIELDS = {
  makerworld: ['categoryId', 'visibility', 'license', 'productMode', 'laserMode'],
  printables: ['publication', 'categoryId', 'licenseId', 'zipMode', 'club', 'store', 'excludeCommercialUsage'],
  cults: ['categoryId', 'licenseType', 'visibility', 'showComments'],
  mmf: ['publication', 'categoryIds', 'licenseId', 'dimensionsUnit', 'technology'],
  thingiverse: ['publication', 'categoryId', 'license'],
  thangs: ['publication', 'structure', 'units', 'category', 'allowRemix', 'feedbackEnabled', 'folderId', 'workspaceId', 'accessTypeId'],
  nexprint: ['publication', 'categoryId', 'licenseType'],
  creality: ['publication', 'categoryId', 'license'],
  makeronline: ['publication', 'categoryId', 'license', 'permission', 'printMethod', 'includePrintProfile', 'relatedKits', 'storeKitIds'],
  makeroad: ['publication', 'printMethods', 'licenseIndex', 'visibility'],
};

export function isProjectBound(key, platformId = '') {
  return !REMEMBERABLE_FIELDS[platformId]?.includes(key);
}

/** The part of a platform's options worth carrying to the next project. */
export function rememberableOptions(opts = {}, platformId = '') {
  const out = {};
  for (const key of REMEMBERABLE_FIELDS[platformId] || []) {
    const value = opts?.[key];
    if (value === undefined || typeof value === 'function') continue;
    out[key] = value;
  }
  return out;
}

export function loadPlatformDefaults(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PLATFORM_DEFAULTS_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function savePlatformDefaults(storage, defaults) {
  try { storage?.setItem(PLATFORM_DEFAULTS_KEY, JSON.stringify(defaults || {})); return true; } catch { return false; }
}

export function rememberPlatform(storage, platformId, opts) {
  const next = { ...loadPlatformDefaults(storage), [platformId]: rememberableOptions(opts, platformId) };
  savePlatformDefaults(storage, next);
  return next;
}

export function forgetPlatform(storage, platformId) {
  const next = { ...loadPlatformDefaults(storage) };
  delete next[platformId];
  savePlatformDefaults(storage, next);
  return next;
}

/** Apply remembered answers over a fresh project's platform settings. */
export function applyPlatformDefaults(platforms, defaults) {
  if (!defaults || !Object.keys(defaults).length) return platforms;
  const out = { ...platforms };
  for (const [id, remembered] of Object.entries(defaults)) {
    if (!out[id] || !remembered || typeof remembered !== 'object') continue;
    out[id] = { ...out[id], ...rememberableOptions(remembered, id) };
  }
  return out;
}

/** How many answers a stored default carries, for the UI. */
export function rememberedCount(defaults, platformId) {
  return Object.keys(rememberableOptions(defaults?.[platformId] || {}, platformId)).length;
}
