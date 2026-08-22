// The project library: many saved projects instead of one autosave slot.
//
// A project's text (title, description, tags, platform settings) is small and
// lives here, in localStorage, one entry per project id. Its files and photos
// live in IndexedDB under the same id (see project-store.js). The id is what
// ties the two together and what a release plan points at, so renaming a
// project can no longer orphan its files or its schedule, which is what keying
// by title did.
//
// Everything in this file is pure and synchronous on purpose: the App calls it
// from effects and handlers, and the tests can drive it with a plain object.

export const LIBRARY_KEY = 'modelprep:projects:v1';
export const CURRENT_PROJECT_KEY = 'modelprep:projects:current:v1';
export const LEGACY_AUTOSAVE_KEY = 'modelprep:autosave:v1';
export const LEGACY_AUTOSAVE_HANDLED_KEY = 'modelprep:autosave:handled:v1';

export function newProjectId(now = Date.now(), random = Math.random) {
  return `p_${now.toString(36)}_${random().toString(36).slice(2, 8)}`;
}

function read(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}
function write(storage, key, value) {
  try {
    if (value == null) storage?.removeItem(key);
    else storage?.setItem(key, value);
    return true;
  } catch { return false; }
}

/** Every saved project, newest edit first. */
export function loadLibrary(storage) {
  try {
    const parsed = JSON.parse(read(storage, LIBRARY_KEY) || '[]');
    return Array.isArray(parsed) ? sortEntries(parsed.filter((entry) => entry && entry.id)) : [];
  } catch { return []; }
}

export function saveLibrary(storage, entries) {
  return write(storage, LIBRARY_KEY, JSON.stringify(sortEntries(entries)));
}

export function sortEntries(entries) {
  return [...entries].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function findEntry(entries, id) {
  return entries.find((entry) => entry.id === id) || null;
}

export function upsertEntry(entries, entry) {
  return sortEntries([...entries.filter((existing) => existing.id !== entry.id), entry]);
}

export function removeEntry(entries, id) {
  return entries.filter((entry) => entry.id !== id);
}

export function readCurrentId(storage) {
  return read(storage, CURRENT_PROJECT_KEY) || null;
}

export function writeCurrentId(storage, id) {
  return write(storage, CURRENT_PROJECT_KEY, id || null);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "21 Aug 2026". Day first, no locale surprises in a project name. */
export function formatProjectDate(timestamp) {
  const date = new Date(timestamp || 0);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * What a project is called. A name the user typed wins. Otherwise the listing
 * title, because that is what the creator already thinks of it as. Before a
 * title exists, the date it was started, so a library of fresh projects still
 * tells them apart.
 */
export function autoProjectName({ name = '', nameLocked = false, title = '', createdAt = 0 } = {}) {
  const typed = String(name || '').trim();
  if (nameLocked && typed) return typed;
  const fromTitle = String(title || '').trim();
  if (fromTitle) return fromTitle;
  return `Project ${formatProjectDate(createdAt || Date.now())}`;
}

/** "Copy of X", then "Copy of X (2)" and so on, never colliding. */
export function duplicateName(name, existingNames = []) {
  const taken = new Set(existingNames.map((existing) => String(existing).trim().toLowerCase()));
  const base = `Copy of ${String(name || '').trim() || 'project'}`;
  if (!taken.has(base.toLowerCase())) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base} (${index})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/**
 * The library row for a project. `meta` is what serializeProjectMeta returns,
 * `summary` is what the list shows without opening the project.
 */
export function entryFromProject(project, meta, summary = {}, now = Date.now()) {
  return {
    id: project.id,
    name: autoProjectName(project),
    nameLocked: !!project.nameLocked,
    title: project.title || '',
    createdAt: project.createdAt || now,
    updatedAt: now,
    meta,
    summary: {
      files: summary.files ?? (project.files || []).length,
      images: summary.images ?? (project.images || []).length,
      stepsDone: summary.stepsDone ?? 0,
      stepCount: summary.stepCount ?? 0,
    },
  };
}

/**
 * Whether a saved entry has anything worth listing. Mirrors what the App
 * considers content; an empty project never enters the library.
 */
export function entryHasContent(entry) {
  const meta = entry?.meta || {};
  return !!(entry?.summary?.files || entry?.summary?.images || meta.title || meta.description || (meta.tags || []).length);
}

/**
 * Bring the single-slot autosave from before the library into it, once.
 *
 * Returns the entry it created, or null when there was nothing to migrate.
 * The legacy keys are removed so the migration cannot run twice and resurrect
 * a project the user has since deleted.
 */
export function migrateLegacyAutosave(storage, { now = Date.now(), id = newProjectId(now) } = {}) {
  const raw = read(storage, LEGACY_AUTOSAVE_KEY);
  if (!raw) return null;
  let saved = null;
  try { saved = JSON.parse(raw); } catch { saved = null; }
  write(storage, LEGACY_AUTOSAVE_KEY, null);
  write(storage, LEGACY_AUTOSAVE_HANDLED_KEY, null);
  if (!saved || (!saved.title && !saved.description && !(saved.tags || []).length)) return null;

  const entries = loadLibrary(storage);
  const createdAt = saved.savedAt || now;
  const entry = {
    id,
    // The old slot had a free-text name that defaulted to "Untitled Project";
    // only a name that differs from that default counts as typed.
    name: saved.name && saved.name !== 'Untitled Project' ? saved.name : autoProjectName({ title: saved.title, createdAt }),
    nameLocked: !!(saved.name && saved.name !== 'Untitled Project' && saved.name !== saved.title),
    title: saved.title || '',
    createdAt,
    updatedAt: createdAt,
    // The legacy record keyed its binaries by name/title; the App falls back
    // to that key when nothing is stored under the id.
    legacyBinaryKey: { name: saved.name || 'Untitled Project', title: saved.title || '' },
    meta: saved,
    summary: { files: 0, images: 0, stepsDone: 0, stepCount: 0 },
  };
  saveLibrary(storage, upsertEntry(entries, entry));
  writeCurrentId(storage, id);
  return entry;
}

/**
 * Which due, scheduled plans belong to a saved project other than the open
 * one. Plans written before the library carry no projectId, so those match
 * by title, the way the queue itself still does.
 */
export function duePlansForOtherProjects(plans, entries, currentId, now = Date.now()) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const byTitle = new Map(entries.map((entry) => [String(entry.title || entry.name || '').trim().toLowerCase(), entry]));
  const out = [];
  for (const plan of plans || []) {
    if (plan.status !== 'pending' || plan.mode !== 'scheduled') continue;
    if (!(Date.parse(plan.dueAt) <= now)) continue;
    const entry = plan.projectId
      ? byId.get(plan.projectId)
      : byTitle.get(String(plan.projectTitle || '').trim().toLowerCase());
    if (!entry || entry.id === currentId) continue;
    out.push({ plan, entry });
  }
  return out;
}
