export const CREALITY_MODEL_FORMATS = ['stl', 'obj', 'ply', 'off', '3mf', '3ds', 'wrl', 'dae', 'step', 'stp'];
const CREALITY_NON_RENDERED_PREVIEW_FORMATS = new Set(['3mf', 'step', 'stp']);
export const CREALITY_INSTRUCTION_FORMATS = [
  'txt', 'pdf', 'doc', 'xls', 'html', 'rtf', 'gif', 'bmp', 'docx', 'xlsx',
  'pptx', 'wps', 'png', 'ppt', 'jpg', 'jpeg',
];

export const CREALITY_LICENSES = [
  { value: 'CC BY', label: 'CC BY — Attribution' },
  { value: 'CC0', label: 'CC0 — Public Domain' },
  { value: 'CC BY-SA', label: 'CC BY-SA — Attribution, ShareAlike' },
  { value: 'CC BY-ND', label: 'CC BY-ND — Attribution, NoDerivatives' },
  { value: 'CC BY-NC', label: 'CC BY-NC — Attribution, NonCommercial' },
  { value: 'CC BY-NC-SA', label: 'CC BY-NC-SA — NonCommercial, ShareAlike' },
  { value: 'CC BY-NC-ND', label: 'CC BY-NC-ND — NonCommercial, NoDerivatives' },
  { value: 'CXY-SL', label: 'Creality Standard License — personal use only' },
];

export const CREALITY_LICENSE_MAP = {
  cc0: 'CC0',
  ccby: 'CC BY',
  ccbysa: 'CC BY-SA',
  ccbynd: 'CC BY-ND',
  ccbync: 'CC BY-NC',
  ccbyncsa: 'CC BY-NC-SA',
  standard: 'CXY-SL',
};

// Signed-in create form plus categoryList { type: 7 }, 2026-07-31. Creality's
// picker permits both top-level and second-level choices; these are the stable
// API categoryId values, not the menu's zero-based positions.
export const CREALITY_CATEGORIES = [
  { id: '1731', label: '3D Printers', children: [
    ['1316', '3D Printer Parts'], ['1904', '3D Printer Accessories'], ['1645', 'Test Models'], ['6006', 'Other'],
  ] },
  { id: '1670', label: 'Art & Design', children: [
    ['1662', 'Digital Art'], ['1584', 'Sculptures & Artworks'], ['1341', 'Badges & Coins'],
    ['1997', 'Industrial Design & Prototypes'], ['6005', 'Other'],
  ] },
  { id: '1809', label: 'Toys & Games', children: [
    ['1575', 'Board Games & Card Games'], ['1141', 'Construction Toys'], ['1793', 'Game Props'], ['6007', 'Other'],
  ] },
  { id: '1519', label: 'Hobbies & DIY', children: [
    ['1741', 'Electronics & RC (Remote Control)'], ['1648', 'Robots & Mechs'], ['1194', 'Drones & Aircraft'],
    ['1420', 'Sound & Audio Equipment'], ['1246', 'Sports & Exercise Equipment'], ['6004', 'Other'],
  ] },
  { id: '1010', label: 'Household', children: [
    ['1150', 'Home Decorations & Ornaments'], ['1096', 'Lighting & Lamps'], ['1775', 'Home Appliance Accessories'],
    ['1671', 'Tools & Spare Parts'], ['1151', 'Pets'], ['6000', 'Other'],
  ] },
  { id: '1175', label: 'Fashion', children: [
    ['1966', 'Cosplay'], ['1693', 'Jewelry & Accessories'], ['1598', 'Apparel, Shoes & Hats'],
    ['1647', 'Personal Accessories'], ['6002', 'Other'],
  ] },
  { id: '1501', label: 'Education', children: [
    ['1974', 'Stationery & Learning Tools'], ['1343', 'Educational Aids'], ['6003', 'Other'],
  ] },
  { id: '1952', label: 'Miniatures', children: [
    ['1025', 'Characters & Creatures'], ['1888', 'Miniature Games & Accessories'], ['1846', 'Props & Terrain'],
    ['1982', 'Vehicles & Machinery'], ['6008', 'Other'],
  ] },
  { id: '1160', label: 'Medical & Health', children: [
    ['1192', 'Medical & Health Equipment'], ['1765', 'Personal Care Devices'], ['6001', 'Other'],
  ] },
  { id: '6012', label: 'MakeNow', children: [
    ['6014', 'MagicRelief'], ['6010', 'CubeMe'], ['6013', 'SnapForm'], ['6011', 'SignForge'],
  ] },
];

export function crealityCategoryLabel(id) {
  const wanted = String(id || '');
  for (const category of CREALITY_CATEGORIES) {
    if (category.id === wanted) return category.label;
    const child = category.children.find(([childId]) => childId === wanted);
    if (child) return `${category.label} › ${child[1]}`;
  }
  return '';
}

// The current first-party model uploader skips browser-rendered cover metadata
// for these formats and sends only the uploaded file record. Creality validates
// that distinction when saving drafts.
export function crealityUsesRenderedModelCover(fileName) {
  const match = /\.([^.]+)$/.exec(String(fileName || ''));
  const ext = match ? match[1].toLowerCase() : '';
  return !!ext && !CREALITY_NON_RENDERED_PREVIEW_FORMATS.has(ext);
}

// Creality has two mutually exclusive upload modes: a slicer-generated Print
// Configuration File, or raw STL/CAD/ordinary-3MF model files. Until the former
// is implemented, never mislabel a project print profile as a raw model.
export function crealityRawModelFiles(files, profiles = []) {
  const profileFileIds = new Set((profiles || []).map((profile) => String(profile?.fileId || '')));
  return (files || []).filter((file) => {
    const match = /\.([^.]+)$/.exec(String(file?.name || ''));
    const ext = match ? match[1].toLowerCase() : '';
    return !!file?.blob
      && CREALITY_MODEL_FORMATS.includes(ext)
      && !profileFileIds.has(String(file?.id || ''));
  });
}
