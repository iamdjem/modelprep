// Real .3mf metadata reader. A .3mf is a ZIP package; every slicer signs the
// files it writes, so reading a few small metadata entries identifies which
// slicer produced the file plus its headline print settings. Geometry is never
// parsed here. All failures resolve to { slicer: 'unknown', sliced: false } so
// a malformed file can never block import.

export const SLICERS = {
  bambu: 'Bambu Studio',
  orca: 'OrcaSlicer',
  elegoo: 'Elegoo Slicer',
  crealityprint: 'Creality Print',
  prusa: 'PrusaSlicer',
  cura: 'Cura',
  anycubic: 'Anycubic Slicer',
  unknown: 'Unknown',
};

export function slicerLabel(slicer) {
  return SLICERS[slicer] || SLICERS.unknown;
}

// Map the Application/generator string a slicer embeds to our slicer id.
// Order matters: Orca derivatives name themselves before mentioning Orca.
export function detectSlicerFromApplication(application) {
  const app = String(application || '');
  if (!app) return 'unknown';
  if (/bambu\s*studio/i.test(app)) return 'bambu';
  if (/elegoo/i.test(app)) return 'elegoo';
  if (/creality/i.test(app)) return 'crealityprint';
  if (/anycubic/i.test(app)) return 'anycubic';
  if (/orca/i.test(app)) return 'orca';
  if (/prusa|slic3r/i.test(app)) return 'prusa';
  if (/cura/i.test(app)) return 'cura';
  return 'unknown';
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}min` : `${minutes}min`;
}

// The effective slicer for a project file: an explicit user override always
// wins over what was detected inside the package.
export function fileSlicer(file) {
  return file?.slicerOverride || file?.threemf?.slicer || 'unknown';
}

// Parse a .3mf blob. loadZip is injected (the app passes its lazy JSZip
// loader) so tests can run without the bundle's code-splitting.
export async function parseThreeMF(blob, loadZip) {
  const result = { slicer: 'unknown', application: null, sliced: false, scanned: true };
  let zip;
  try {
    const JSZip = await loadZip();
    zip = await JSZip.loadAsync(blob);
  } catch {
    return result; // not a readable ZIP package
  }

  const read = async (name) => {
    const entry = zip.file(name);
    if (!entry) return null;
    try { return await entry.async('string'); } catch { return null; }
  };

  // 1. Generator identity from the model part's Application metadata.
  const model = await read('3D/3dmodel.model');
  if (model) {
    result.application = firstMatch(model, [
      /<metadata\s+name="Application"[^>]*>([^<]+)<\/metadata>/i,
      /<metadata\s+name="BambuStudio:Application"[^>]*>([^<]+)<\/metadata>/i,
    ]);
  }

  // 2. Slicer-family fingerprints. PrusaSlicer writes Slic3r_PE.config; the
  // Bambu/Orca family writes slice_info.config + project_settings.config.
  const prusaConfig = await read('Metadata/Slic3r_PE.config');
  const sliceInfo = await read('Metadata/slice_info.config');
  const projectSettings = await read('Metadata/project_settings.config');

  result.slicer = detectSlicerFromApplication(result.application);
  if (result.slicer === 'unknown' && prusaConfig != null) result.slicer = 'prusa';
  if (result.slicer === 'unknown' && (sliceInfo != null || projectSettings != null)) {
    const body = `${sliceInfo || ''}\n${projectSettings || ''}`;
    result.slicer = detectSlicerFromApplication(firstMatch(body, [
      /<header_item\s+key="X-BBL-Client-Type"\s+value="([^"]+)"/i,
      /"from"\s*:\s*"([^"]+)"/i,
    ]) || (/(BambuStudio|bbl)/i.test(body) ? 'Bambu Studio' : ''));
    if (result.slicer === 'unknown') result.slicer = 'orca';
  }

  // 3. Headline print settings, when the package carries them.
  if (projectSettings) {
    try {
      const settings = JSON.parse(projectSettings);
      const one = (value) => (Array.isArray(value) ? value[0] : value);
      result.printer = one(settings.printer_model) || one(settings.printer_settings_id) || null;
      result.material = one(settings.filament_type) || null;
      const layer = one(settings.layer_height);
      result.layerHeight = layer ? `${layer}mm` : null;
      const infill = one(settings.sparse_infill_density);
      result.infill = infill ?? null;
    } catch { /* settings stay unset */ }
  }
  if (sliceInfo) {
    const plates = String(sliceInfo).match(/<plate>/gi);
    if (plates) result.plates = plates.length;
    result.estimatedTime = formatSeconds(firstMatch(sliceInfo, [
      /key="prediction"\s+value="(\d+)"/i,
    ])) || null;
    const grams = firstMatch(sliceInfo, [/key="weight"\s+value="([\d.]+)"/i]);
    if (grams) result.filamentGrams = Math.round(Number(grams));
    result.sliced = true;
  }
  if (prusaConfig) {
    result.sliced = true;
    result.printer = result.printer
      || firstMatch(prusaConfig, [/printer_model\s*=\s*(.+)/]);
    result.material = result.material
      || firstMatch(prusaConfig, [/filament_type\s*=\s*(.+)/]);
    const layer = firstMatch(prusaConfig, [/^layer_height\s*=\s*([\d.]+)/m]);
    if (layer && !result.layerHeight) result.layerHeight = `${layer}mm`;
  }

  // Vendor forks of Bambu Studio can keep the upstream Application string
  // (Anycubic Slicer Next reports "BambuStudio-1.4.1.0"), so an apparently
  // Bambu package targeting another vendor's printer is that vendor's fork.
  // Confirmed against a real Anycubic-sliced file on 2026-08-04.
  if (result.slicer === 'bambu' && result.printer) {
    if (/anycubic/i.test(result.printer)) result.slicer = 'anycubic';
    else if (/creality/i.test(result.printer)) result.slicer = 'crealityprint';
    else if (/elegoo/i.test(result.printer)) result.slicer = 'elegoo';
  }

  // 5. The embedded plate render. Slicers in the Bambu/Orca family write the
  // sliced plate as a PNG inside the package, and the 3MF/OPC standard location
  // is Metadata/thumbnail.png. This is the most honest preview available: it is
  // what the slicer itself produced, so it shows the actual arrangement on the
  // build plate rather than a re-render of the raw mesh.
  result.thumbnail = await readPackageThumbnail(zip);

  return result;
}

// Ordered by usefulness: a full plate render beats a small one, and both beat a
// bare model thumbnail. Falls back to any PNG in Metadata/ so a slicer we have
// not seen still gets a preview.
const THUMBNAIL_ENTRIES = [
  'Metadata/plate_1.png',
  'Metadata/plate_no_light_1.png',
  'Metadata/thumbnail.png',
  'Metadata/plate_1_small.png',
  'Metadata/top_1.png',
];

async function readPackageThumbnail(zip) {
  const names = [...THUMBNAIL_ENTRIES];
  try {
    for (const name of Object.keys(zip.files || {})) {
      if (/^Metadata\/.+\.png$/i.test(name) && !names.includes(name)) names.push(name);
    }
  } catch { /* fall back to the known names */ }
  for (const name of names) {
    const entry = zip.file(name);
    if (!entry) continue;
    try {
      const base64 = await entry.async('base64');
      if (base64) return `data:image/png;base64,${base64}`;
    } catch { /* try the next candidate */ }
  }
  return null;
}
