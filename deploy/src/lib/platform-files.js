// Per-platform file selection. Each platform's options may carry
// `excludedFileIds`; every publish flow and preflight passes its candidate
// file list through withoutExcluded so an empty/missing list is a guaranteed
// no-op (today's behavior) and exclusions compose with each flow's own
// format filtering.

export function excludedIdSet(platformOpts) {
  const ids = platformOpts?.excludedFileIds;
  return new Set(Array.isArray(ids) ? ids.map(String) : []);
}

export function withoutExcluded(files, platformOpts) {
  const excluded = excludedIdSet(platformOpts);
  if (!excluded.size) return files;
  return (files || []).filter((file) => !excluded.has(String(file?.id)));
}

export function isFileExcluded(file, platformOpts) {
  return excludedIdSet(platformOpts).has(String(file?.id));
}

export function toggleExcludedFileId(platformOpts, fileId) {
  const excluded = excludedIdSet(platformOpts);
  const id = String(fileId);
  if (excluded.has(id)) excluded.delete(id); else excluded.add(id);
  return [...excluded];
}
