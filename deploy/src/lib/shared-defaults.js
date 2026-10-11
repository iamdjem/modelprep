// Shared-to-platform default mapping.
//
// The Details step promises "Each platform has its own category tree. We pick
// a close match for each." This module is what makes that true. For every
// shared category it declares one audited platform-native value per platform,
// and for the shared license it fills the four platforms that previously
// hardcoded a default regardless of the user's choice (MyMiniFactory,
// Thingiverse, Thangs, MakerRoad) plus Cults3D's CC family.
//
// Values are materialized into project.platforms.<id> by
// deriveSharedDefaultPatches, called from an App effect. Rules:
//   - only empty fields are filled ('' / [] / null / undefined);
//   - a filled field is marked categoryAuto/licenseAuto: true;
//   - panels set the flag to false on manual change, which stops re-mapping;
//   - while the flag is true, changing the shared value re-derives the match.
// Upload flows are untouched: they read the same option fields as before.
//
// Category ids come from the audited taxonomy snapshots in this repo
// (lib/*.js, data/makerworld-categories.json) and the platform flow docs in
// backend/docs. Printables is deliberately NOT hardcoded: its flow doc requires
// server-driven categories, so Printables is matched against the live
// /api/v1/printables/meta list by label path (see matchPrintablesCategory).
// Nexprint and MakerOnline ids are the documented audit snapshots; both
// platforms re-validate ids server-side at upload, so drift fails visibly
// instead of silently.

// Shared category label -> platform-native category value + display label.
// A missing platform entry means "no close match": the field stays empty and
// the existing preflight blocker keeps asking for a manual choice.
//
// MyMiniFactory is the sparse one on purpose. Its taxonomy is five trees
// (Tabletop, PDF Only, Toys, Home & Decor, RC Cars), with nothing for fashion,
// electronics, education, cosplay, or a generic Other, so those five shared
// categories stay unmapped rather than land a listing somewhere wrong.
export const SHARED_CATEGORY_DEFAULTS = {
  'Home & Living': {
    makerworld: { field: 'categoryId', value: 406, label: 'Household › Other House Models' },
    cults: { field: 'categoryId', value: '30', label: 'Home & living' },
    mmf: { field: 'categoryIds', value: [57, 335], label: 'Home & Decor › Home Decor' },
    thingiverse: { field: 'categoryId', value: '67', label: 'Household' },
    thangs: { field: 'category', value: 'Home & Garden', label: 'Home & Garden' },
    creality: { field: 'categoryId', value: '1010', label: 'Household' },
    nexprint: { field: 'categoryId', value: '1422473859014661', label: 'Home & Decoration › Organization & Storage' },
    makeronline: { field: 'categoryId', value: '45', label: 'Household › Other Household' },
    makeroad: { field: 'categoryPaths', value: ['Home & Living › Other'], label: 'Home & Living › Other' },
    printables: ['Household > Home Decor'],
  },
  'Tools': {
    makerworld: { field: 'categoryId', value: 706, label: 'Tools › Other Tools' },
    cults: { field: 'categoryId', value: '27', label: 'Tools' },
    mmf: { field: 'categoryIds', value: [57, 252], label: 'Home & Decor › Workshop & Tools' },
    thingiverse: { field: 'categoryId', value: '71', label: 'Tools' },
    thangs: { field: 'category', value: 'Tools & Organizers', label: 'Tools & Organizers' },
    creality: { field: 'categoryId', value: '1671', label: 'Household › Tools & Spare Parts' },
    nexprint: { field: 'categoryId', value: '1422473859022860', label: 'Tools › Tools & Accessories' },
    makeronline: { field: 'categoryId', value: '57', label: 'Tools › Other Tools' },
    makeroad: { field: 'categoryPaths', value: ['Tools › Household Tools'], label: 'Tools › Household Tools' },
    printables: ['Hobby & Makers > Tools'],
  },
  'Toys & Games': {
    makerworld: { field: 'categoryId', value: 805, label: 'Toys & Games › Other Toys & Games' },
    cults: { field: 'categoryId', value: '31', label: 'Toys & games' },
    mmf: { field: 'categoryIds', value: [60, 100], label: 'Toys › Puzzles & Games' },
    thingiverse: { field: 'categoryId', value: '72', label: 'Toys & Games' },
    thangs: { field: 'category', value: 'Toys & Games', label: 'Toys & Games' },
    creality: { field: 'categoryId', value: '1809', label: 'Toys & Games' },
    nexprint: { field: 'categoryId', value: '1422473859006468', label: 'Toys & Games › Others' },
    makeronline: { field: 'categoryId', value: '63', label: 'Toys&Games › Other Toys&Games' },
    makeroad: { field: 'categoryPaths', value: ['Games & Toys › Other'], label: 'Games & Toys › Other' },
    printables: ['Toys & Games > Other Toys & Games'],
  },
  'Hobby & DIY': {
    makerworld: { field: 'categoryId', value: 307, label: 'Hobby & DIY › Other Hobby & DIY' },
    cults: { field: 'categoryId', value: '29', label: 'Hobby & DIY' },
    thingiverse: { field: 'categoryId', value: '66', label: 'Hobby' },
    thangs: { field: 'category', value: 'Hobby & DIY', label: 'Hobby & DIY' },
    mmf: { field: 'categoryIds', value: [57, 252], label: 'Home & Decor › Workshop & Tools' },
    creality: { field: 'categoryId', value: '1519', label: 'Hobbies & DIY' },
    nexprint: { field: 'categoryId', value: '1422473859014660', label: 'Electronics & Digital › Others' },
    makeronline: { field: 'categoryId', value: '54', label: 'Hobby&DIY › Other Hobby&DIY' },
    makeroad: { field: 'categoryPaths', value: ['Hobbies and DIY › DIY'], label: 'Hobbies and DIY › DIY' },
    printables: ['Hobby & Makers > Other Ideas'],
  },
  'Art & Decor': {
    makerworld: { field: 'categoryId', value: 105, label: 'Art › Other Art Models' },
    cults: { field: 'categoryId', value: '23', label: 'Art' },
    mmf: { field: 'categoryIds', value: [57, 335], label: 'Home & Decor › Home Decor' },
    thingiverse: { field: 'categoryId', value: '63', label: 'Art' },
    thangs: { field: 'category', value: 'Art & Decor', label: 'Art & Decor' },
    creality: { field: 'categoryId', value: '1670', label: 'Art & Design' },
    nexprint: { field: 'categoryId', value: '1422473859022851', label: 'Art & Music › 3D Art' },
    makeronline: { field: 'categoryId', value: '71', label: 'Art › Other Art' },
    makeroad: { field: 'categoryPaths', value: ['Art & Design › Artwork'], label: 'Art & Design › Artwork' },
    printables: ['Art & Design > Other Art & Designs'],
  },
  'Fashion & Jewelry': {
    makerworld: { field: 'categoryId', value: 207, label: 'Fashion › Other Fashion Models' },
    cults: { field: 'categoryId', value: '24', label: 'Fashion & jewelry' },
    thingiverse: { field: 'categoryId', value: '64', label: 'Fashion' },
    thangs: { field: 'category', value: 'Fashion & Jewelry', label: 'Fashion & Jewelry' },
    creality: { field: 'categoryId', value: '1175', label: 'Fashion' },
    nexprint: { field: 'categoryId', value: '1422473859014675', label: 'Fashion › Accessories' },
    makeronline: { field: 'categoryId', value: '77', label: 'Fashion › Other Fashion' },
    makeroad: { field: 'categoryPaths', value: ['Fashion Wearables › Jewelry'], label: 'Fashion Wearables › Jewelry' },
    printables: ['Fashion > Other Fashion Accessories'],
  },
  'Electronics & Tech': {
    makerworld: { field: 'categoryId', value: 301, label: 'Hobby & DIY › Electronics' },
    cults: { field: 'categoryId', value: '25', label: 'Electronics' },
    thingiverse: { field: 'categoryId', value: '65', label: 'Gadgets' },
    thangs: { field: 'category', value: 'Hobby & DIY/Electronics', label: 'Hobby & DIY › Electronics' },
    creality: { field: 'categoryId', value: '1741', label: 'Hobbies & DIY › Electronics & RC' },
    nexprint: { field: 'categoryId', value: '1422473859014660', label: 'Electronics & Digital › Others' },
    makeronline: { field: 'categoryId', value: '48', label: 'Hobby&DIY › Electronics' },
    makeroad: { field: 'categoryPaths', value: ['Hobbies and DIY › Digital Accessories'], label: 'Hobbies and DIY › Digital Accessories' },
    printables: ['Gadgets > Other Gadgets'],
  },
  'Outdoor & Garden': {
    makerworld: { field: 'categoryId', value: 402, label: 'Household › Garden' },
    cults: { field: 'categoryId', value: '30', label: 'Home & living' },
    mmf: { field: 'categoryIds', value: [57, 150], label: 'Home & Decor › Garden & Outdoors' },
    thingiverse: { field: 'categoryId', value: '98', label: 'Household › Outdoor & Garden' },
    thangs: { field: 'category', value: 'Home & Garden/Outdoor & Garden', label: 'Home & Garden › Outdoor & Garden' },
    creality: { field: 'categoryId', value: '1010', label: 'Household' },
    nexprint: { field: 'categoryId', value: '1422473859014668', label: 'Home & Decoration › Gardening & Courtyard' },
    makeronline: { field: 'categoryId', value: '39', label: 'Household › Garden' },
    makeroad: { field: 'categoryPaths', value: ['Tools › Gardening Tools'], label: 'Tools › Gardening Tools' },
    printables: ['Household > Outdoor & Garden'],
  },
  'Educational': {
    makerworld: { field: 'categoryId', value: 507, label: 'Education › Other Education Models' },
    cults: { field: 'categoryId', value: '29', label: 'Hobby & DIY' },
    thingiverse: { field: 'categoryId', value: '69', label: 'Learning' },
    thangs: { field: 'category', value: 'Educational & Scientific', label: 'Educational & Scientific' },
    creality: { field: 'categoryId', value: '1501', label: 'Education' },
    nexprint: { field: 'categoryId', value: '1422473859014665', label: 'Home & Decoration › Education & Stationery' },
    makeronline: { field: 'categoryId', value: '83', label: 'Education › Other Education' },
    makeroad: { field: 'categoryPaths', value: ['Tools › Stationery & Aids'], label: 'Tools › Stationery & Aids' },
    printables: ['Learning > Other 3D Objects for Learning'],
  },
  'Miniatures & Tabletop': {
    makerworld: { field: 'categoryId', value: 605, label: 'Miniatures › Other Miniatures' },
    cults: { field: 'categoryId', value: '31', label: 'Toys & games' },
    mmf: { field: 'categoryIds', value: [1015, 617], label: 'Tabletop › Accessories' },
    thingiverse: { field: 'categoryId', value: '70', label: 'Models' },
    thangs: { field: 'category', value: 'Miniatures & Tabletop', label: 'Miniatures & Tabletop' },
    creality: { field: 'categoryId', value: '1952', label: 'Miniatures' },
    nexprint: { field: 'categoryId', value: '1422473859006464', label: 'Toys & Games › Miniature Model' },
    makeronline: { field: 'categoryId', value: '96', label: 'Miniatures › Other' },
    makeroad: { field: 'categoryPaths', value: ['Hobbies and DIY › Miniature Model'], label: 'Hobbies and DIY › Miniature Model' },
    printables: ['Tabletop Miniatures > Characters & Monsters'],
  },
  'Cosplay & Props': {
    makerworld: { field: 'categoryId', value: 1004, label: 'Props & Cosplays › Other Props & Cosplays' },
    cults: { field: 'categoryId', value: '24', label: 'Fashion & jewelry' },
    thingiverse: { field: 'categoryId', value: '142', label: 'Fashion › Costume' },
    thangs: { field: 'category', value: 'Costumes & Cosplay', label: 'Costumes & Cosplay' },
    creality: { field: 'categoryId', value: '1966', label: 'Fashion › Cosplay' },
    nexprint: { field: 'categoryId', value: '1422473859006467', label: 'Toys & Games › Cosplay Costumes & Props' },
    makeronline: { field: 'categoryId', value: '91', label: 'Costumes & Cosplay › Other' },
    makeroad: { field: 'categoryPaths', value: ['Games & Toys › Game Props'], label: 'Games & Toys › Game Props' },
    printables: ['Costumes & Accessories > Cosplay & Costumes in general'],
  },
  'Holiday & Seasonal': {
    makerworld: { field: 'categoryId', value: 403, label: 'Household › Festivities' },
    cults: { field: 'categoryId', value: '30', label: 'Home & living' },
    thingiverse: { field: 'categoryId', value: '97', label: 'Household › Decor' },
    thangs: { field: 'category', value: 'Seasonal', label: 'Seasonal' },
    mmf: { field: 'categoryIds', value: [57, 335, 372], label: 'Home & Decor › Home Decor › Ornaments' },
    creality: { field: 'categoryId', value: '1150', label: 'Household › Home Decorations & Ornaments' },
    nexprint: { field: 'categoryId', value: '1422473859014662', label: 'Home & Decoration › Ornamentation' },
    makeronline: { field: 'categoryId', value: '42', label: 'Household › Festivities' },
    makeroad: { field: 'categoryPaths', value: ['Home & Living › Decor'], label: 'Home & Living › Decor' },
    printables: ['Seasonal designs > '],
  },
  // "Other" means "none of the above", which no platform's taxonomy can
  // represent honestly. Only Thingiverse has a real Other leaf. Everywhere
  // else the field stays empty and the platform's own blocker asks.
  'Other': {
    thingiverse: { field: 'categoryId', value: '0', label: 'Other' },
  },
};

// Shared license id -> platform-native license for the platforms that had no
// map before. A null value means the platform cannot represent the license;
// the legacy default is materialized instead and flagged as inexact so the
// panel says "closest available".
export const MMF_LICENSE_MAP = {
  cc0: 1, ccby: 2, ccbysa: 3, ccbync: 4, ccbyncsa: 5, ccbynd: 6, ccbyncnd: 7, standard: null,
};
export const THINGIVERSE_LICENSE_MAP = {
  cc0: 'pd0', ccby: 'cc', ccbysa: 'cc-sa', ccbync: 'cc-nc', ccbyncsa: 'cc-nc-sa', ccbynd: 'cc-nd', ccbyncnd: 'cc-nc-nd', standard: null,
};
export const THANGS_LICENSE_MAP = {
  cc0: 'CC0', ccby: 'CC BY', ccbysa: 'CC BY-SA', ccbync: 'CC BY-NC', ccbyncsa: 'CC BY-NC-SA', ccbynd: 'CC BY-ND', ccbyncnd: 'CC BY-NC-ND', standard: null,
};
// Index into MAKEROAD_LICENSES (lib/makeroad.js).
export const MAKEROAD_LICENSE_MAP = {
  ccby: 0, ccbysa: 1, ccbync: 2, ccbyncsa: 3, ccbyncnd: 4, ccbynd: 5, cc0: 6, standard: null,
};
// Cults keeps its explicit-choice policy for the paid Standard license (the
// free/paid class couples to price); the free CC family maps exactly.
export const CULTS_LICENSE_MAP = {
  cc0: 'cc_pddc', ccby: 'cc_by', ccbysa: 'cc_by_sa', ccbynd: 'cc_by_nd', ccbync: 'cc_by_nc', ccbyncsa: 'cc_by_nc_sa', ccbyncnd: 'cc_by_nc_nd',
};

// Legacy hardcoded defaults, materialized as the "closest available" value
// when the shared license has no platform equivalent.
const LEGACY_LICENSE_FALLBACK = {
  mmf: { field: 'licenseId', value: 5 },
  thingiverse: { field: 'license', value: 'cc-nc' },
  thangs: { field: 'license', value: 'CC BY-NC' },
  makeroad: { field: 'licenseIndex', value: 2 },
};

const LICENSE_TARGETS = {
  mmf: { field: 'licenseId', map: MMF_LICENSE_MAP },
  thingiverse: { field: 'license', map: THINGIVERSE_LICENSE_MAP },
  thangs: { field: 'license', map: THANGS_LICENSE_MAP },
  makeroad: { field: 'licenseIndex', map: MAKEROAD_LICENSE_MAP },
  cults: { field: 'licenseType', map: CULTS_LICENSE_MAP },
};

function isEmptyValue(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value) === '';
}

function sameValue(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => String(item) === String(b[index]));
  }
  return String(a) === String(b);
}

// Match a shared category against the live Printables category list from
// /api/v1/printables/meta. Only subcategories (level !== 0) are selectable in
// the Printables editor. Candidates are "Top > Sub" path strings; a trailing
// "> " acts as a prefix match picking the first subcategory of that group.
export function matchPrintablesCategory(categories, sharedCategory) {
  const candidates = SHARED_CATEGORY_DEFAULTS[sharedCategory]?.printables;
  if (!Array.isArray(candidates) || !Array.isArray(categories)) return null;
  const rows = categories
    .filter((category) => category && category.level !== 0)
    .map((category) => {
      const parents = (category.path || []).map((part) => String(part?.name || '').trim()).filter(Boolean);
      const chain = parents.includes(String(category.name)) ? parents : [...parents, String(category.name)];
      return { id: String(category.id), pathLabel: chain.join(' > ') };
    });
  for (const candidate of candidates) {
    const wanted = candidate.toLowerCase();
    const match = candidate.endsWith('> ')
      ? rows.find((row) => row.pathLabel.toLowerCase().startsWith(wanted.trim()))
      : rows.find((row) => row.pathLabel.toLowerCase() === wanted);
    if (match) return { id: match.id, label: match.pathLabel };
  }
  return null;
}

// Compute the option patches that make the shared Details choices real on
// every platform. Returns { [platformId]: patch } or null when nothing needs
// to change. Never overwrites a non-empty value unless this module set it
// (categoryAuto/licenseAuto true) and the shared source changed.
// Shared AI disclosure -> the field each platform actually sends. Nine panels
// asked this question; the creator answers it once in Details.
const AI_TARGETS = {
  makerworld: 'aiGenerated',
  printables: 'aiGenerated',
  cults: 'madeWithAi',
  thingiverse: 'aiGenerated',
  thangs: 'aiGenerated',
  nexprint: 'aiGenerated',
  makeronline: 'aiHelp',
  makeroad: 'aiGenerated',
};

// Shared NSFW toggle -> the same. Platforms without an NSFW field are absent;
// Thingiverse sends it as a tag, which its adapter already handles.
const NSFW_TARGETS = {
  makerworld: 'nsfw',
  printables: 'nsfw',
  thingiverse: 'nsfw',
  nexprint: 'nsfw',
  creality: 'nsfw',
  makeronline: 'nsfw',
  makeroad: 'nsfw',
};

// Shared provenance -> each platform's origin enum, source-URL field, and
// "what did you change" field. Platform-only identifiers a URL cannot express
// (a Thingiverse Thing ID, MyMiniFactory parent object ids) stay in their own
// panels and are asked for only when the shared origin is Remix.
export function provenancePatch(platformId, provenance = {}) {
  const remix = provenance.origin === 'remix';
  const url = String(provenance.sourceUrl || '').trim();
  const changes = String(provenance.changes || '').trim();
  switch (platformId) {
    case 'makerworld':
      return { modelSource: remix ? 'remix' : 'original', remixUrl: remix ? url : '', remixDescription: remix ? changes : '' };
    case 'printables':
      // 'reupload' is a third Printables-only state; never overwrite it.
      return { authorship: remix ? 'remix' : 'author', remixDescription: remix ? changes : '' };
    case 'nexprint':
      // 1 original, 2 adapted, 3 reprint. A remix is an adaptation.
      return { originalityType: remix ? 2 : 1, sourceUrl: remix ? url : '' };
    case 'creality':
      // 1 original, 2 non-original, 3 remix.
      return { modelSource: remix ? 3 : 1, sourceUrl: remix ? url : '' };
    case 'makeronline':
      return { source: remix ? 2 : 1, originalUrl: remix ? url : '' };
    case 'makeroad':
      // 1 original, 2 remix.
      return { uploadType: remix ? 2 : 1, referUrl: remix ? url : '' };
    case 'thingiverse':
      return { remix };
    case 'mmf':
      return { remix };
    default:
      return null;
  }
}

// The sliced 3MF already knows the printer, material, layer height, infill,
// print time and filament weight. Four platforms ask the creator to type them
// again. This reads the first sliced profile in the package and fills the
// native fields that are still empty, never overwriting a typed value.
// 3MF spec unit names -> the codes Thangs accepts. Micron and foot have no
// Thangs equivalent, so they are absent and the default stays.
const THREEMF_UNITS = { millimeter: 'mm', centimeter: 'cm', meter: 'm', inch: 'in' };

export function packageDerivedPatch(platformId, opts = {}, threemf = null) {
  if (!threemf || !threemf.sliced) return null;
  const printer = String(threemf.printer || '').trim();
  const material = String(threemf.material || '').trim();
  const layerHeight = String(threemf.layerHeight || '').trim();
  const infill = String(threemf.infill || '').trim();
  const grams = Number(threemf.filamentGrams) || 0;
  const patch = {};
  if (platformId === 'thingiverse') {
    const settings = opts.printSettings || {};
    const next = { ...settings };
    if (!String(settings.printer || '').trim() && printer) next.printer = printer;
    if (!String(settings.material || '').trim() && material) next.material = material;
    if (!String(settings.resolution || '').trim() && layerHeight) next.resolution = layerHeight;
    if (!String(settings.infill || '').trim() && infill) next.infill = infill;
    if (Object.keys(next).length !== Object.keys(settings).length) patch.printSettings = next;
  }
  if (platformId === 'mmf') {
    if (isEmptyValue(opts.technology) && printer) patch.technology = 'FDM';
    if (isEmptyValue(opts.materialQuantity) && grams > 0) patch.materialQuantity = `${Math.round(grams)} g`;
  }
  if (platformId === 'thangs' && threemf.units) {
    // Thangs asks for the unit the mesh is authored in; the 3MF <model unit="…">
    // attribute already says. Only a non-default unit is worth writing.
    const unit = THREEMF_UNITS[String(threemf.units).toLowerCase()];
    if (unit && unit !== 'mm' && (opts.units || 'mm') === 'mm') patch.units = unit;
  }
  return Object.keys(patch).length ? patch : null;
}

// Thangs needs one part flagged primary. Its panel displayed the first model
// file as the choice but never stored it, so preflight kept asking for a pick
// the creator could see already made.
export function thangsPrimaryFilePatch(opts = {}, modelFiles = []) {
  if (!modelFiles.length) return null;
  const current = String(opts.primaryFileId || '');
  if (current && modelFiles.some((file) => String(file.id) === current)) return null;
  return { primaryFileId: String(modelFiles[0].id) };
}

export function deriveSharedDefaultPatches(project, extras = {}) {
  const platforms = project?.platforms;
  if (!platforms) return null;
  const patches = {};
  const queue = (platformId, patch) => {
    patches[platformId] = { ...(patches[platformId] || {}), ...patch };
  };

  const sharedCategory = String(project.category || '');
  const categoryRow = SHARED_CATEGORY_DEFAULTS[sharedCategory] || null;
  for (const [platformId, opts] of Object.entries(platforms)) {
    if (!opts || platformId === 'printables') continue;
    const target = categoryRow?.[platformId];
    const autoEligible = opts.categoryAuto === true
      || (opts.categoryAuto == null && isEmptyValue(opts[target?.field ?? 'categoryId']));
    if (target && !Array.isArray(target)) {
      if (autoEligible && !sameValue(opts[target.field] ?? '', target.value)) {
        queue(platformId, { [target.field]: target.value, categoryAuto: true });
      }
    } else if (sharedCategory && opts.categoryAuto === true) {
      // The shared category changed to one this platform has no match for.
      const field = platformId === 'mmf' ? 'categoryIds'
        : platformId === 'makeroad' ? 'categoryPaths'
          : platformId === 'thangs' ? 'category' : 'categoryId';
      if (!isEmptyValue(opts[field])) queue(platformId, { [field]: Array.isArray(opts[field]) ? [] : '' });
    }
  }

  const printablesOpts = platforms.printables;
  if (printablesOpts) {
    const live = matchPrintablesCategory(extras.printablesCategories, sharedCategory);
    const autoEligible = printablesOpts.categoryAuto === true
      || (printablesOpts.categoryAuto == null && isEmptyValue(printablesOpts.categoryId));
    if (live && autoEligible && !sameValue(printablesOpts.categoryId ?? '', live.id)) {
      queue('printables', { categoryId: live.id, categoryAuto: true });
    }
  }

  const sharedLicense = String(project.license || '');
  for (const [platformId, target] of Object.entries(LICENSE_TARGETS)) {
    const opts = platforms[platformId];
    if (!opts || !sharedLicense) continue;
    const autoEligible = opts.licenseAuto === true
      || (opts.licenseAuto == null && isEmptyValue(opts[target.field]));
    if (!autoEligible) continue;
    const mapped = target.map[sharedLicense];
    if (mapped != null) {
      if (!sameValue(opts[target.field] ?? '', mapped) || opts.licenseAutoExact === false) {
        queue(platformId, { [target.field]: mapped, licenseAuto: true, licenseAutoExact: true });
      }
    } else {
      const fallback = LEGACY_LICENSE_FALLBACK[platformId];
      if (fallback && (!sameValue(opts[target.field] ?? '', fallback.value) || opts.licenseAutoExact !== false)) {
        queue(platformId, { [fallback.field]: fallback.value, licenseAuto: true, licenseAutoExact: false });
      }
      // Cults has no legacy fallback: the explicit-choice blocker stays.
    }
  }

  // The three shared answers. These are not "defaults" with a manual twin:
  // the per-platform controls are gone, so the shared value is simply written
  // through every time it changes.
  const provenance = project.provenance || {};
  const aiGenerated = !!project.aiGenerated;
  const nsfw = !!project.nsfw;
  // A field the platform's options object does not declare is a field that
  // platform does not have. Writing one would invent a field for an adapter
  // that never reads it.
  const declares = (opts, key) => Object.prototype.hasOwnProperty.call(opts, key);
  for (const [platformId, opts] of Object.entries(platforms)) {
    if (!opts) continue;
    const aiField = AI_TARGETS[platformId];
    if (aiField && declares(opts, aiField) && opts[aiField] !== aiGenerated) queue(platformId, { [aiField]: aiGenerated });
    const nsfwField = NSFW_TARGETS[platformId];
    if (nsfwField && declares(opts, nsfwField) && opts[nsfwField] !== nsfw) queue(platformId, { [nsfwField]: nsfw });
    // MakerWorld has a third, platform-only Share source. Once the creator
    // chooses a MakerWorld override, do not immediately replace it with the
    // shared Original/Remix answer on the next render.
    const originPatch = platformId === 'makerworld' && opts.modelSourceAuto === false
      ? null
      : provenancePatch(platformId, provenance);
    if (originPatch) {
      const changed = Object.entries(originPatch)
        .filter(([key]) => declares(opts, key))
        .filter(([key]) => !(key === 'authorship' && opts.authorship === 'reupload'))
        .filter(([key, value]) => !sameValue(opts[key] ?? '', value));
      if (changed.length) queue(platformId, Object.fromEntries(changed));
    }
  }

  // Values the package already carries. `extras.thangsModelFiles` is the same
  // eligible list the Thangs uploader builds, passed in so this module does not
  // need the platform format tables.
  const slicedProfile = (project.files || []).find((file) => file?.threemf?.sliced)?.threemf || null;
  for (const [platformId, opts] of Object.entries(platforms)) {
    if (!opts) continue;
    const derived = packageDerivedPatch(platformId, opts, slicedProfile);
    if (derived) queue(platformId, derived);
  }
  if (platforms.thangs) {
    const primary = thangsPrimaryFilePatch(platforms.thangs, extras.thangsModelFiles || []);
    if (primary) queue('thangs', primary);
  }

  return Object.keys(patches).length ? patches : null;
}
