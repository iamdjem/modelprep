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

// Keys that name this project's own files, pictures or a specific other
// model, or that shared-defaults derives on its own.
const PROJECT_BOUND = /file|image|photo|cover|remix|related|parent|verifyObjectId|contest|Auto(Exact)?$|^enabled$|^price$/i;

export function isProjectBound(key) {
  return PROJECT_BOUND.test(key);
}

/** The part of a platform's options worth carrying to the next project. */
export function rememberableOptions(opts = {}) {
  const out = {};
  for (const [key, value] of Object.entries(opts || {})) {
    if (isProjectBound(key)) continue;
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
  const next = { ...loadPlatformDefaults(storage), [platformId]: rememberableOptions(opts) };
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
    out[id] = { ...out[id], ...rememberableOptions(remembered) };
  }
  return out;
}

/** How many answers a stored default carries, for the UI. */
export function rememberedCount(defaults, platformId) {
  return Object.keys(defaults?.[platformId] || {}).length;
}
