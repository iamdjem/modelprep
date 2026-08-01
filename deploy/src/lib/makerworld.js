import { fileExt } from './format.js';

// Current MakerWorld upload vocab, re-checked against the live account flow on
// 2026-07-18. Keep the two products separate: the same project can contain files
// for both, but only the selected product's files should be sent to its API.
export const MAKERWORLD_REGULAR_FORMATS = [
  '3mf', 'stl', 'step', 'stp', 'obj', '3ds', 'amf', 'dwg', 'dxf', 'f3d',
  'factory', 'fcstd', 'iges', 'ipt', 'ply', 'rsdoc', 'scad', 'shape',
  'shapr', 'skp', 'sldasm', 'sldprt', 'slvs', 'studio3', 'stpz', 'zip',
];

export const MAKERWORLD_LASER_FORMATS = [
  'lac', 'svg', 'dxf', 'jpg', 'jpeg', 'png', 'bmp', 'webp', 'ai',
];

const REGULAR_SET = new Set(MAKERWORLD_REGULAR_FORMATS);
const LASER_SET = new Set(MAKERWORLD_LASER_FORMATS);

export function isMakerWorldRegularFile(name) {
  return REGULAR_SET.has(fileExt(name));
}

export function isMakerWorldLaserFile(name) {
  return LASER_SET.has(fileExt(name));
}

export function makerWorldFilesForMode(files, productMode = '3d') {
  const accepts = productMode === 'laser-cut' ? isMakerWorldLaserFile : isMakerWorldRegularFile;
  return (files || []).filter((file) => accepts(file.name));
}

export function flattenMakerWorldCategories(tree) {
  const out = [];
  for (const parent of tree || []) {
    out.push({ id: parent.id, label: parent.name, parentId: null, isLeaf: !(parent.children || []).length });
    for (const child of parent.children || []) {
      out.push({ id: child.id, label: `${parent.name} › ${child.name}`, parentId: parent.id, isLeaf: true });
    }
  }
  return out;
}

// Product names and device codes currently shown by the live print-profile editor.
// MakerWorld still auto-detects the native printer from the 3MF; these are optional
// additional-compatibility overrides selected by the creator.
export const MAKERWORLD_PRINTERS = [
  { product: 'P1S', model: 'C12' },
  { product: 'X1 Carbon', model: 'BL-P001' },
  { product: 'X1', model: 'BL-P002' },
  { product: 'X1E', model: 'C13' },
  { product: 'P1P', model: 'C11' },
  { product: 'P2S', model: 'N7' },
  { product: 'A1 mini', model: 'N1' },
  { product: 'A1', model: 'N2S' },
  { product: 'H2C', model: 'O1C2' },
  { product: 'H2D', model: 'O1D' },
  { product: 'H2D Pro', model: 'O1E' },
  { product: 'H2S', model: 'O1S' },
  { product: 'X2D', model: 'N6' },
  { product: 'A2L', model: 'N9' },
];

export function compatibilityFromProducts(products, nozzleDiameter = 0.4) {
  const selected = new Set(products || []);
  return MAKERWORLD_PRINTERS
    .filter((printer) => selected.has(printer.product))
    .map((printer) => ({
      dev_setting_name: '',
      dev_model_name: printer.model,
      dev_product_name: printer.product,
      nozzle_diameter: nozzleDiameter,
    }));
}

export const MAKERWORLD_REMIX_FORBIDDEN_LICENSES = new Set([
  'BY-ND',
  'BY-NC-ND',
  'Standard Digital File License',
  'MakerWorld Exclusive License',
  'Standard Digital File License - Community Use',
  'Standard Digital File License - Platform Print Only (SDFL-PPO)',
]);

export function makerWorldLicenseAllowsRemix(license) {
  return !license || !MAKERWORLD_REMIX_FORBIDDEN_LICENSES.has(license);
}

export function makerWorldPrimaryProfile(project, opts = {}) {
  const profiles = project?.profiles || [];
  const preferred = opts.primaryProfileFileId;
  return profiles.find((profile) => profile.fileId === preferred) || profiles[0] || null;
}

function findNestedValue(root, keys, depth = 0, seen = new Set()) {
  if (root == null || depth > 8 || typeof root !== 'object' || seen.has(root)) return undefined;
  seen.add(root);
  for (const [key, value] of Object.entries(root)) if (keys.has(key.toLowerCase()) && value != null) return value;
  for (const value of Object.values(root)) {
    const found = findNestedValue(value, keys, depth + 1, seen);
    if (found != null) return found;
  }
  return undefined;
}

function stringList(value) {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : String(item?.id ?? item?.name ?? '')).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

/** Normalize metadata found in a Bambu Suite .lac JSON document. The package format
 * has used both camelCase and snake_case keys, so matching is deliberately tolerant. */
export function lacMetadataFromValue(value) {
  const plates = findNestedValue(value, new Set(['plates', 'platelist', 'plate_list']));
  const processTypes = findNestedValue(value, new Set(['processtypes', 'process_types', 'processes']));
  const machineName = findNestedValue(value, new Set(['machinename', 'machine_name', 'device_name']));
  const materialIds = findNestedValue(value, new Set(['materialids', 'material_ids', 'materials']));
  const otherTools = findNestedValue(value, new Set(['othertools', 'other_tools']));
  const compatibleDevices = findNestedValue(value, new Set(['compatibledevicesselected', 'compatible_devices_selected', 'compatibledevices']));
  const model2DInfo = findNestedValue(value, new Set(['model2dinfo', 'model_2d_info']));
  return {
    lacInfo: {
      plates: Array.isArray(plates) ? plates : [],
      processTypes: stringList(processTypes),
      machineName: typeof machineName === 'string' ? machineName : String(machineName?.name || ''),
      materialIds: stringList(materialIds),
    },
    lacCustomInfo: {
      otherTools: typeof otherTools === 'string' ? otherTools : '',
      compatibleDevicesSelected: stringList(compatibleDevices),
    },
    model2DInfo: model2DInfo && typeof model2DInfo === 'object' && !Array.isArray(model2DInfo) ? model2DInfo : {},
  };
}

/** Read the JSON metadata embedded in a Bambu Suite .lac package. The ZIP loader
 * is injected so the app can keep JSZip code-split and tests can provide it
 * directly. Plain JSON fixtures are supported for diagnostics. */
export async function readLacMetadata(blob, loadZip) {
  const empty = {
    lacInfo: { plates: [], processTypes: [], machineName: '', materialIds: [] },
    lacCustomInfo: { otherTools: '', compatibleDevicesSelected: [] },
    model2DInfo: {},
  };
  if (!blob?.arrayBuffer) return empty;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const documents = [];
  const addJson = (value) => { try { documents.push(JSON.parse(value)); } catch { /* not JSON */ } };
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    if (!loadZip) throw new Error('A ZIP reader is required for this .lac package.');
    const JSZip = await loadZip();
    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.json$/i.test(entry.name)).slice(0, 50);
    for (const entry of entries) {
      const declaredSize = entry._data?.uncompressedSize ?? 0;
      if (declaredSize > 5 * 1024 * 1024) continue;
      const value = await entry.async('string');
      if (value.length <= 5 * 1024 * 1024) addJson(value);
    }
  } else {
    addJson(new TextDecoder().decode(bytes));
  }
  return documents.reduce((combined, document) => {
    const found = lacMetadataFromValue(document);
    return {
      lacInfo: {
        plates: combined.lacInfo.plates.length ? combined.lacInfo.plates : found.lacInfo.plates,
        processTypes: combined.lacInfo.processTypes.length ? combined.lacInfo.processTypes : found.lacInfo.processTypes,
        machineName: combined.lacInfo.machineName || found.lacInfo.machineName,
        materialIds: combined.lacInfo.materialIds.length ? combined.lacInfo.materialIds : found.lacInfo.materialIds,
      },
      lacCustomInfo: {
        otherTools: combined.lacCustomInfo.otherTools || found.lacCustomInfo.otherTools,
        compatibleDevicesSelected: combined.lacCustomInfo.compatibleDevicesSelected.length
          ? combined.lacCustomInfo.compatibleDevicesSelected : found.lacCustomInfo.compatibleDevicesSelected,
      },
      model2DInfo: Object.keys(combined.model2DInfo).length ? combined.model2DInfo : found.model2DInfo,
    };
  }, empty);
}

/**
 * Pure publish validation shared by the rendered flow and tests. Runtime-only
 * File objects (documentation/CyberBrick) are supplied as counts so project
 * autosave remains serializable.
 */
export function makerWorldPublishIssues(project, opts = {}, runtime = {}) {
  const errors = [];
  const warnings = [];
  const productMode = opts.productMode || '3d';
  const files = makerWorldFilesForMode(project?.files || [], productMode);
  const images = project?.images || [];
  const MB = 1024 * 1024;

  if (!String(project?.title || '').trim()) errors.push('Add a model title.');
  if (String(project?.title || '').length > 50) errors.push('MakerWorld model titles are limited to 50 characters.');
  if (!images.length || !project?.coverImageId) errors.push('Select a cover image.');
  if (images.length > 17) warnings.push(`MakerWorld accepts one cover plus 16 model pictures; ${images.length - 17} image(s) will not upload.`);
  errors.push(...(runtime.videoIssues || []));
  if (!files.length) errors.push(productMode === 'laser-cut'
    ? 'Add at least one Laser & Cut file (.lac, .svg, .dxf, image, or .ai).'
    : 'Add at least one MakerWorld 3D model file.');
  for (const file of files) {
    const limitMb = fileExt(file.name) === '3mf' ? 150 : 200;
    if ((file.size || 0) > limitMb * MB) errors.push(`${file.name} exceeds MakerWorld's ${limitMb}MB per-file limit.`);
  }
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  if (totalBytes > 250 * MB) errors.push('MakerWorld model files exceed the 250MB total limit.');
  if ((project?.tags || []).length > 50) errors.push('MakerWorld accepts at most 50 tags.');
  const searchableText = [project?.title, project?.description, ...(project?.tags || [])].filter(Boolean).join('\n').toLocaleLowerCase();
  const blockedWords = [...new Set((runtime.forbiddenWords || [])
    .filter((word) => String(word || '').trim())
    .filter((word) => searchableText.includes(String(word).trim().toLocaleLowerCase())))];
  if (blockedWords.length) errors.push(`MakerWorld currently blocks: ${blockedWords.join(', ')}.`);
  if (runtime.uploadAllowed === false) errors.push('MakerWorld upload is disabled for this account.');
  if (opts.cyberBrick && runtime.rcUpload === false) errors.push('CyberBrick upload is not enabled for this MakerWorld account.');

  if (opts.modelSource === 'remix') {
    const remixUrl = String(opts.remixUrl || '').trim();
    if (!opts.remixModel && !remixUrl) errors.push('Paste or select the original model used for this remix.');
    if (remixUrl) {
      try { new URL(remixUrl); } catch { errors.push('Enter a valid URL for the original remix source.'); }
    }
    if (!String(opts.remixDescription || '').trim()) errors.push('Explain what you changed in the remix.');
    if (!opts.remixModel && !String(opts.remixLicense || '').trim()) errors.push('Select the original model license.');
    if (!makerWorldLicenseAllowsRemix(opts.remixLicense || opts.remixModel?.license)) errors.push('The selected original license does not allow derivatives.');
  }

  if (productMode === 'laser-cut') {
    const laserMode = opts.laserMode || 'raw';
    const lacFiles = files.filter((file) => fileExt(file.name) === 'lac');
    if (laserMode === 'lac' && !lacFiles.length) errors.push('Bambu Suite mode requires a primary .lac file.');
    if (laserMode === 'lac') {
      const laserInfo = opts.laserInfo || {};
      const laserProfile = opts.laserProfile || {};
      if (!String(laserInfo.machineName || '').trim() || !String(laserInfo.processTypes || '').trim()) {
        warnings.push('Machine/process metadata will be read from the .lac file; enter overrides if the package does not contain it.');
      }
      if (!String(laserProfile.title || '').trim()) errors.push('Add a Laser & Cut profile name for the .lac package.');
      if (String(laserProfile.title || '').length > 60) errors.push('MakerWorld Laser & Cut profile names are limited to 60 characters.');
      const laserPictureIds = [...new Set([
        laserProfile.useMainCover ? project?.coverImageId : laserProfile.coverImageId,
        ...(laserProfile.photoIds || []),
      ].filter(Boolean))];
      if (!laserPictureIds.length) errors.push('Select at least one Laser & Cut profile picture.');
      if (laserPictureIds.length > 37) errors.push('MakerWorld accepts at most 37 Laser & Cut profile pictures.');
    }
    if (opts.cyberBrick && laserMode !== 'lac') errors.push('CyberBrick is only available for Bambu Suite .lac Laser & Cut uploads.');
    if (opts.cyberBrick && !(runtime.cyberControlCount > 0)) errors.push('CyberBrick requires at least one control configuration JSON file.');
    return { errors, warnings, files };
  }

  if (!String(project?.description || '').trim()) errors.push('Add a model description.');
  if (!(Number(opts.categoryId) > 0)) errors.push('Choose a MakerWorld category.');

  if (opts.modelSource === 'remix') {
    if (opts.exclusive) errors.push('Remixes are not eligible for MakerWorld Exclusive.');
  }

  if (opts.exclusive && !opts.exclusiveTermsAccepted) errors.push('Accept the MakerWorld Exclusive terms for this model.');
  if (opts.cyberBrick && !(runtime.cyberControlCount > 0)) errors.push('CyberBrick requires at least one control configuration JSON file.');

  const primaryFile = (project?.files || []).find((file) => file.id === opts.primaryProfileFileId)
    || (project?.files || []).find((file) => fileExt(file.name) === '3mf');
  if (opts.cyberBrick && (!primaryFile || fileExt(primaryFile.name) !== '3mf')) errors.push('CyberBrick is only available for the Bambu Studio 3MF path.');
  if (primaryFile && fileExt(primaryFile.name) === '3mf') {
    const profile = (project?.profiles || []).find((item) => item.fileId === primaryFile.id);
    if (!profile) errors.push('Configure the selected Bambu Studio print profile.');
    else {
      if (!String(profile.name || '').trim()) errors.push('Add a print-profile name.');
      if (String(profile.name || '').length > 60) errors.push('MakerWorld print-profile names are limited to 60 characters.');
      if (!(profile.photoIds || []).length) errors.push('Select at least one print-profile photo.');
      if (!profile.useMainCover && !profile.coverImageId) errors.push('Select a print-profile cover image.');
      if (!profile.realPhotoConfirmed) errors.push('Confirm that a selected profile photo shows the real printed model.');
      if (!profile.guidelinesAccepted) errors.push('Accept the MakerWorld Print Profile Guidelines.');
    }
  }

  return { errors, warnings, files };
}
