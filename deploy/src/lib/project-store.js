// Durable storage for the parts of a project that localStorage cannot hold.
//
// Autosave keeps the text (title, tags, platform settings). It cannot keep the
// model files, photos or print profiles, because a single mesh runs to tens of
// megabytes and localStorage tops out around 5MB. The consequence was not just
// a re-import chore: a *scheduled* publish that outlived an app restart could
// never fire, because the files it needed were gone. It sat in the queue going
// further overdue forever.
//
// So binaries live in IndexedDB, which stores Blobs natively and has no
// practical size ceiling beyond the disk quota.
//
// The policy here is pure and tested; the IndexedDB calls are a thin layer over
// it. That split matters because storage bugs are the kind that silently lose a
// maker's work, and "silently" is exactly what tests are for.

export const PROJECT_DB_NAME = 'modelprep';
export const PROJECT_DB_VERSION = 1;
export const PROJECT_STORE = 'projects';

// A generous ceiling that still cannot fill a disk. Real projects are 50-500MB;
// this holds several without ever becoming the reason a machine runs out.
export const DEFAULT_QUOTA_BYTES = 4 * 1024 * 1024 * 1024;   // 4 GB

/** Total bytes a stored record occupies. */
export function recordBytes(record) {
  const files = (record?.files || []).reduce((sum, file) => sum + (file?.size || 0), 0);
  const images = (record?.images || []).reduce((sum, image) => sum + (image?.size || 0), 0);
  return files + images;
}

/**
 * Which records to drop so the store fits under `quota`, oldest first.
 *
 * The project being saved right now is never evicted: dropping the thing the
 * user is working on to make room for it would be absurd. If it alone exceeds
 * the quota it is still kept, and `overQuota` says so, so the caller can tell
 * the user rather than silently storing nothing.
 */
export function planEviction(records = [], { quota = DEFAULT_QUOTA_BYTES, keepKey = null } = {}) {
  const sized = records.map((record) => ({ record, bytes: recordBytes(record) }));
  const total = sized.reduce((sum, entry) => sum + entry.bytes, 0);
  if (total <= quota) return { evict: [], bytes: total, overQuota: false };

  // Oldest first, but never the project we are keeping.
  const candidates = sized
    .filter((entry) => entry.record?.key !== keepKey)
    .sort((a, b) => (a.record?.savedAt || 0) - (b.record?.savedAt || 0));

  const evict = [];
  let running = total;
  for (const entry of candidates) {
    if (running <= quota) break;
    evict.push(entry.record.key);
    running -= entry.bytes;
  }
  return { evict, bytes: running, overQuota: running > quota };
}

/** Stable key for a project. Title can change; this is what ties a plan to its files. */
export function projectStorageKey(project) {
  const id = project?.storageId || project?.name || project?.title || 'untitled';
  return String(id).trim().toLowerCase() || 'untitled';
}

/**
 * Strip a project down to what is worth persisting: the binaries plus the
 * fields needed to rebuild the in-memory shape. Blobs are kept by reference,
 * never copied.
 */
export function serializeProjectBinaries(project) {
  const files = (project?.files || [])
    .filter((file) => file?.blob)
    .map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type || '',
      blob: file.blob,
      isModel: !!file.isModel,
      isProfile: !!file.isProfile,
      isImage: !!file.isImage,
      isLaserCut: !!file.isLaserCut,
      makerWorld: file.makerWorld || null,
      printables: file.printables || null,
      threemf: file.threemf || null,
      slicerOverride: file.slicerOverride || null,
    }));

  const images = (project?.images || [])
    .filter((image) => image?.blob || image?.dataUrl)
    .map((image) => ({
      id: image.id,
      alt: image.alt || '',
      focal: image.focal || { x: 0.5, y: 0.5 },
      naturalW: image.naturalW || 0,
      naturalH: image.naturalH || 0,
      size: image.size || image.blob?.size || estimateDataUrlBytes(image.dataUrl),
      blob: image.blob || null,
      dataUrl: image.blob ? null : image.dataUrl || null,
    }));

  return { files, images };
}

/** base64 expands by 4/3; close enough for quota accounting. */
export function estimateDataUrlBytes(dataUrl) {
  const value = String(dataUrl || '');
  const comma = value.indexOf(',');
  if (comma < 0) return 0;
  return Math.floor((value.length - comma - 1) * 0.75);
}

/**
 * Merge stored binaries back into a restored project.
 *
 * Matching is by id, and anything the store no longer holds is dropped rather
 * than left as a file record with no bytes behind it: a phantom entry would
 * pass pre-flight and then fail mid-upload, which is worse than not being there.
 */
export function rehydrateProject(project, record) {
  if (!record) return project;
  const fileById = new Map((record.files || []).map((file) => [String(file.id), file]));
  const imageById = new Map((record.images || []).map((image) => [String(image.id), image]));

  const files = (record.files || []).map((stored) => ({ ...stored }));
  const images = (record.images || []).map((stored) => ({
    ...stored,
    dataUrl: stored.dataUrl || null,
  }));

  // Profiles reference files and images by id; drop any whose file is gone.
  const profiles = (project?.profiles || []).filter((profile) => fileById.has(String(profile.fileId)));
  const coverImageId = imageById.has(String(project?.coverImageId))
    ? project.coverImageId
    : (images[0]?.id ?? null);

  return { ...project, files, images, profiles, coverImageId };
}

// --- IndexedDB layer --------------------------------------------------------
// Thin on purpose. Every decision above is pure; this only moves bytes.

function openDb(indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const request = indexedDB.open(PROJECT_DB_NAME, PROJECT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        db.createObjectStore(PROJECT_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

function tx(db, mode, body) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PROJECT_STORE, mode);
    const store = transaction.objectStore(PROJECT_STORE);
    let result;
    try { result = body(store); } catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(result?.result ?? result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

const idb = () => (typeof indexedDB !== 'undefined' ? indexedDB : null);

/** Persist a project's binaries. Resolves false rather than throwing: losing a
 *  save must never take the app down mid-edit. */
export async function saveProjectBinaries(project, { factory = idb, quota = DEFAULT_QUOTA_BYTES } = {}) {
  try {
    const db = await openDb(factory());
    const key = projectStorageKey(project);
    const record = { key, savedAt: Date.now(), ...serializeProjectBinaries(project) };
    if (!record.files.length && !record.images.length) return false;

    const existing = await tx(db, 'readonly', (store) => store.getAll());
    const others = (existing || []).filter((entry) => entry.key !== key);
    const { evict } = planEviction([...others, record], { quota, keepKey: key });

    await tx(db, 'readwrite', (store) => {
      for (const staleKey of evict) store.delete(staleKey);
      store.put(record);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadProjectBinaries(project, { factory = idb } = {}) {
  try {
    const db = await openDb(factory());
    const record = await tx(db, 'readonly', (store) => store.get(projectStorageKey(project)));
    db.close();
    return record || null;
  } catch {
    return null;
  }
}

export async function listStoredProjects({ factory = idb } = {}) {
  try {
    const db = await openDb(factory());
    const records = await tx(db, 'readonly', (store) => store.getAll());
    db.close();
    return (records || []).map(({ key, savedAt, files, images }) => ({
      key, savedAt, bytes: recordBytes({ files, images }), fileCount: (files || []).length,
    }));
  } catch {
    return [];
  }
}

export async function clearStoredProject(project, { factory = idb } = {}) {
  try {
    const db = await openDb(factory());
    await tx(db, 'readwrite', (store) => store.delete(projectStorageKey(project)));
    db.close();
    return true;
  } catch {
    return false;
  }
}
