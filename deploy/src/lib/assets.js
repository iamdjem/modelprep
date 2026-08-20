import { fileExt } from './format.js';

export const ASSET_ENTITY_TYPES = Object.freeze({
  asset: 'Asset',
  file: 'AssetFile',
  relation: 'AssetRelation',
  preview: 'DerivedPreview',
});

const PROFILE_TOKENS = /(?:^|[-_.\s])(bambu|orca|prusa|prusaslicer|cura|creality|elegoo|anycubic|profile|sliced|print[-_.\s]?profile)(?=$|[-_.\s])/gi;
const VARIANT_TOKENS = /(?:^|[-_.\s])(small|medium|large|mini|xl|xs|[smlx]|v\d+|rev\d+|copy\s*\d*)(?=$|[-_.\s])/gi;
const ROLE_BY_EXT = {
  stl: 'model', '3mf': 'model', obj: 'model', step: 'source', stp: 'source', fbx: 'model', glb: 'model',
  gcode: 'print-profile', bgcode: 'print-profile', goo: 'print-profile', ctb: 'print-profile',
  pdf: 'documentation', md: 'documentation', txt: 'documentation', doc: 'documentation', docx: 'documentation',
  jpg: 'reference', jpeg: 'reference', png: 'reference', webp: 'reference', gif: 'reference',
};

const stableToken = (value = '') => String(value).trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'asset';

export function canonicalAssetStem(name = '') {
  const extension = fileExt(name);
  const withoutExtension = extension ? String(name).slice(0, -(extension.length + 1)) : String(name);
  const normalized = withoutExtension
    .replace(PROFILE_TOKENS, ' ')
    .replace(VARIANT_TOKENS, ' ')
    .replace(/\([^)]*(?:mm|inch|profile|slicer|plate)[^)]*\)/gi, ' ')
    .replace(/[-_.\s]+/g, ' ')
    .trim();
  return normalized || withoutExtension.trim() || 'Untitled asset';
}

export function inferAssetFileRole(file = {}) {
  if (file.roleOverride) {
    if (file.roleOverride === 'profile') return 'print-profile';
    if (file.roleOverride === 'document') return 'documentation';
    return file.roleOverride;
  }
  if (file.isProfile) return 'print-profile';
  if (file.isImage) return 'reference';
  return ROLE_BY_EXT[fileExt(file.name)] || (file.isModel ? 'model' : 'reference');
}

export function AssetFile(file = {}) {
  return {
    entityType: ASSET_ENTITY_TYPES.file,
    id: String(file.id || `file-${stableToken(file.name)}`),
    name: file.name || 'Untitled file',
    extension: fileExt(file.name),
    role: inferAssetFileRole(file),
    size: Number(file.size) || 0,
    sourcePath: file.sourcePath || file.name || '',
    packagePath: file.packagePath || '',
    contentHash: file.contentHash || null,
    geometryFingerprint: file.geometryFingerprint || null,
    metadata: {
      slicer: file.slicerOverride || file.threemf?.slicer || null,
      printer: file.threemf?.printer || null,
      plates: Number(file.threemf?.plates) || 0,
      triangles: Number(file.geometry?.triangles || file.threemf?.triangles) || 0,
      vertices: Number(file.geometry?.vertices || file.threemf?.vertices) || 0,
      shells: Number(file.geometry?.shells || file.threemf?.shells) || 0,
      materials: Number(file.geometry?.materials || file.threemf?.materials) || 0,
      dimensions: file.geometry?.dimensions || file.threemf?.dimensions || null,
      units: file.geometry?.units || file.threemf?.units || 'mm',
      printTime: file.threemf?.estimatedTime || null,
      filamentGrams: file.threemf?.filamentGrams || null,
    },
    revision: Number(file.revision) || 1,
    versions: Array.isArray(file.assetVersions) ? file.assetVersions : [],
    tags: Array.isArray(file.assetTags) ? file.assetTags : [],
    source: file,
  };
}

export function AssetRelation({ from, to, type = 'contains', metadata = {} } = {}) {
  return {
    entityType: ASSET_ENTITY_TYPES.relation,
    id: `relation-${stableToken(from)}-${type}-${stableToken(to)}`,
    from, to, type, metadata,
  };
}

export function DerivedPreview({ id, assetFileId, kind = 'thumbnail', src = null, plate = null, status = 'ready', metadata = {} } = {}) {
  return {
    entityType: ASSET_ENTITY_TYPES.preview,
    id: id || `preview-${stableToken(assetFileId)}-${kind}${plate ? `-${plate}` : ''}`,
    assetFileId, kind, src, plate, status, metadata,
  };
}

function previewsForFile(file) {
  const previews = [];
  const plateDetails = Array.isArray(file.threemf?.plateDetails) ? file.threemf.plateDetails : [];
  for (const plate of plateDetails) {
    previews.push(DerivedPreview({
      assetFileId: file.id,
      kind: 'plate',
      plate: plate.index,
      src: plate.thumbnail || null,
      status: plate.thumbnail ? 'ready' : 'pending',
      metadata: plate,
    }));
  }
  if (!plateDetails.length && file.threemf?.thumbnail) {
    previews.push(DerivedPreview({ assetFileId: file.id, kind: 'plate', plate: 1, src: file.threemf.thumbnail }));
  }
  if (file.previewDataUrl) previews.push(DerivedPreview({ assetFileId: file.id, kind: 'mesh', src: file.previewDataUrl }));
  return previews;
}

export function Asset({ id, name, files = [], tags = [], relations = [], previews = [], metadata = {} } = {}) {
  return {
    entityType: ASSET_ENTITY_TYPES.asset,
    id, name, files, tags, relations, previews, metadata,
  };
}

export function groupProjectAssets(files = [], { manualGroups = {} } = {}) {
  const groups = new Map();
  for (const original of files || []) {
    const file = AssetFile(original);
    const manualId = original.assetId || manualGroups?.[original.id];
    const folderKey = original.packagePath ? `${original.packagePath}/` : '';
    const key = manualId || `asset-${stableToken(`${folderKey}${canonicalAssetStem(original.name)}`)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }

  return [...groups.entries()].map(([id, assetFiles]) => {
    const primary = assetFiles.find((file) => file.role === 'model') || assetFiles[0];
    const relations = assetFiles.filter((file) => file.id !== primary.id).map((file) => AssetRelation({
      from: primary.id,
      to: file.id,
      type: file.role === 'print-profile' ? 'print-profile' : file.role === 'documentation' ? 'documentation' : 'variant',
    }));
    const tags = [...new Set(assetFiles.flatMap((file) => file.tags))];
    const previews = assetFiles.flatMap((file) => previewsForFile(file.source));
    const plateCount = Math.max(0, ...assetFiles.map((file) => file.metadata.plates || 0));
    const bytes = assetFiles.reduce((sum, file) => sum + file.size, 0);
    return Asset({
      id,
      name: canonicalAssetStem(primary.name),
      files: assetFiles,
      tags,
      relations,
      previews,
      metadata: {
        bytes,
        plateCount,
        modelCount: assetFiles.filter((file) => file.role === 'model').length,
        profileCount: assetFiles.filter((file) => file.role === 'print-profile').length,
        documentCount: assetFiles.filter((file) => file.role === 'documentation').length,
        slicers: [...new Set(assetFiles.map((file) => file.metadata.slicer).filter(Boolean))],
        printers: [...new Set(assetFiles.map((file) => file.metadata.printer).filter(Boolean))],
      },
    });
  });
}

export function assetPrintabilityIssues(asset, plate = null) {
  const issues = [];
  if (!asset?.files?.some((file) => file.role === 'model')) issues.push({ id: 'missing-model', level: 'blocked', label: 'No model file' });
  for (const file of asset?.files || []) {
    const dimensions = file.metadata?.dimensions;
    if (plate && dimensions && (dimensions.x > plate.width || dimensions.y > plate.depth || dimensions.z > plate.height)) {
      issues.push({ id: `outside-${file.id}`, level: 'blocked', label: `${file.name} exceeds the selected build volume` });
    }
    if (file.role === 'model' && !file.metadata?.units) issues.push({ id: `units-${file.id}`, level: 'warning', label: `${file.name} has unknown units` });
  }
  return issues;
}

export function suggestAssetTags(asset = {}) {
  const text = `${asset.name || ''} ${(asset.files || []).map((file) => file.name).join(' ')}`.toLowerCase();
  const tags = new Set(asset.tags || []);
  const rules = [
    ['calibration', /calibrat|test|benchmark/], ['functional', /bracket|mount|holder|hinge|gear/],
    ['miniature', /miniature|figure|terrain/], ['container', /box|case|tray|container/],
    ['multi-plate', /plate/], ['print-profile', /profile|sliced/],
  ];
  for (const [tag, pattern] of rules) if (pattern.test(text)) tags.add(tag);
  if ((asset.metadata?.plateCount || 0) > 1) tags.add('multi-plate');
  return [...tags];
}

export function matchesAssetQuery(asset, query = '') {
  const terms = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const files = asset.files || [];
  const text = [asset.name, ...(asset.tags || []), ...files.flatMap((file) => [file.name, file.extension, file.role, file.metadata?.slicer, file.metadata?.printer])].filter(Boolean).join(' ').toLowerCase();
  return terms.every((term) => {
    const [key, value] = term.includes(':') ? term.split(/:(.+)/) : [null, term];
    if (!key) return text.includes(value);
    if (key === 'type') return files.some((file) => file.extension === value);
    if (key === 'role') return files.some((file) => file.role.includes(value));
    if (key === 'tag') return (asset.tags || []).some((tag) => tag.toLowerCase().includes(value));
    if (key === 'slicer') return files.some((file) => String(file.metadata?.slicer || '').toLowerCase().includes(value));
    if (key === 'printer') return files.some((file) => String(file.metadata?.printer || '').toLowerCase().includes(value));
    return text.includes(term);
  });
}

export function replaceAssetFileRevision(file, replacement, now = Date.now()) {
  const previous = {
    revision: Number(file.revision) || 1,
    name: file.name,
    size: file.size,
    type: file.type || '',
    contentHash: file.contentHash || null,
    replacedAt: now,
  };
  return {
    ...file,
    name: replacement.name || file.name,
    size: Number(replacement.size) || 0,
    type: replacement.type || file.type || '',
    blob: replacement,
    contentHash: null,
    revision: previous.revision + 1,
    assetVersions: [...(file.assetVersions || []), previous],
  };
}

export function assignFilesToAsset(files = [], fileIds = [], assetId) {
  const selected = new Set(fileIds.map(String));
  return files.map((file) => selected.has(String(file.id)) ? { ...file, assetId } : file);
}

export function geometrySimilarityFingerprint(metadata = {}) {
  const dimensions = metadata.dimensions || {};
  const rounded = (value, precision = 1) => Number.isFinite(Number(value)) ? Math.round(Number(value) / precision) * precision : 0;
  return [rounded(dimensions.x), rounded(dimensions.y), rounded(dimensions.z), rounded(metadata.triangles, 100), rounded(metadata.shells)].join(':');
}

export function buildAssetCollections(assets = [], duplicateAssetIds = new Set()) {
  return [
    { id: 'all', label: 'All assets', count: assets.length },
    { id: 'models', label: 'Models', count: assets.filter((asset) => asset.metadata.modelCount).length },
    { id: 'profiles', label: 'Print profiles', count: assets.filter((asset) => asset.metadata.profileCount).length },
    { id: 'multi-plate', label: 'Multi-plate', count: assets.filter((asset) => asset.metadata.plateCount > 1).length },
    { id: 'issues', label: 'Needs review', count: assets.filter((asset) => duplicateAssetIds.has(asset.id) || assetPrintabilityIssues(asset).length).length },
  ];
}
