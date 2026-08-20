import { fileExt } from './format.js';

export async function inspectArchive(blob, loadZip) {
  if (!blob) return { entries: [], error: 'Archive bytes are unavailable.' };
  try {
    const JSZip = await loadZip();
    const zip = await JSZip.loadAsync(blob);
    const entries = Object.values(zip.files || {}).filter((entry) => !entry.dir).map((entry) => ({
      path: entry.name,
      name: entry.name.split('/').pop(),
      extension: fileExt(entry.name),
      modifiedAt: entry.date?.getTime?.() || null,
      role: ['stl', '3mf', 'obj', 'step', 'stp'].includes(fileExt(entry.name)) ? 'model' : ['pdf', 'md', 'txt'].includes(fileExt(entry.name)) ? 'documentation' : 'reference',
    }));
    return { entries, error: null };
  } catch (error) { return { entries: [], error: error?.message || 'Unreadable ZIP archive.' }; }
}
