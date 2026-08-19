// Demo data for the design-system prototype. Mirrors the real calibration-puck
// fixture so screens read truthfully, but nothing here touches the real app.

export const PROJECT = {
  name: 'Calibration puck 34 mm',
  updated: 'Edited 12 minutes ago',
};

export const FILES = [
  { id: 'stl-s', name: 'calibration-puck-34mm.stl', kind: 'Model', format: 'STL', size: '36.1 KB', tris: '1,284 tris', dims: '34 × 34 × 4.4 mm', status: 'ready' },
  { id: 'stl-m', name: 'calibration-puck-34mm-thick.stl', kind: 'Model', format: 'STL', size: '54.1 KB', tris: '1,892 tris', dims: '34 × 34 × 6.0 mm', status: 'ready' },
  { id: '3mf', name: 'calibration-puck-bambu.3mf', kind: 'Project', format: '3MF', size: '30.8 KB', tris: 'Bambu Studio', dims: 'Unsliced, model only', status: 'attention' },
];

export const IMAGES = [
  { id: 'i1', label: 'Cover render', cover: true },
  { id: 'i2', label: 'Front' },
  { id: 'i3', label: 'Overhead' },
  { id: 'i4', label: 'Detail' },
  { id: 'i5', label: 'On printer bed' },
  { id: 'i6', label: 'Hand scale' },
];

export const LISTING = {
  title: 'Calibration puck, 34 mm first-layer and dimension test',
  summary: 'A small puck for dialing in first-layer squish, XY dimensional accuracy, and top-surface finish in one five-minute print.',
  tags: ['calibration', 'test-print', 'first-layer', 'tolerance', 'benchmark', 'quick-print'],
  license: 'CC BY-NC 4.0',
  category: 'Testing models',
};

export const PLATFORMS = [
  { id: 'makerworld', name: 'MakerWorld', org: 'Bambu Lab', dot: '#FF6900', enabled: true, account: 'alex@modelprep.app', ready: false, note: 'Needs print photo' },
  { id: 'printables', name: 'Printables', org: 'Prusa Research', dot: '#FA6831', enabled: true, account: 'alex@modelprep.app', ready: true, note: null },
  { id: 'cults', name: 'Cults3D', org: 'Independent', dot: '#B085F5', enabled: true, account: 'alexadzhem', ready: true, note: null },
  { id: 'mmf', name: 'MyMiniFactory', org: 'SoulCrafted', dot: '#4FB286', enabled: false, account: null, ready: false, note: 'Not connected' },
  { id: 'thingiverse', name: 'Thingiverse', org: 'Thingiverse', dot: '#248BFB', enabled: true, account: 'alex_prints', ready: true, note: null },
  { id: 'thangs', name: 'Thangs', org: 'Physna', dot: '#3A86FF', enabled: false, account: 'alex_prints', ready: false, note: null },
  { id: 'nexprint', name: 'Nexprint', org: 'Elegoo', dot: '#FFB627', enabled: true, account: 'alex@modelprep.app', ready: true, note: null },
  { id: 'creality', name: 'Creality Cloud', org: 'Creality', dot: '#E63946', enabled: true, account: 'alex@modelprep.app', ready: true, note: null },
  { id: 'makeronline', name: 'MakerOnline', org: 'Anycubic', dot: '#111827', enabled: false, account: null, ready: false, note: 'Not connected' },
  { id: 'makeroad', name: 'MakerRoad', org: 'Independent', dot: '#7048E8', enabled: false, account: 'alex@modelprep.app', ready: false, note: 'Rejects synthetic photos' },
];

export const PUBLISH_ROWS = [
  { id: 'printables', name: 'Printables', dot: '#FA6831', state: 'done', detail: 'Draft 1803724 · 3 files, 10 images', progress: 100 },
  { id: 'nexprint', name: 'Nexprint', dot: '#FFB627', state: 'done', detail: 'Draft retained · all files verified', progress: 100 },
  { id: 'creality', name: 'Creality Cloud', dot: '#E63946', state: 'uploading', detail: 'Uploading images · 7 of 11', progress: 64 },
  { id: 'thingiverse', name: 'Thingiverse', dot: '#248BFB', state: 'queued', detail: 'Waiting for slot', progress: 0 },
  { id: 'cults', name: 'Cults3D', dot: '#B085F5', state: 'queued', detail: 'Waiting for slot', progress: 0 },
  { id: 'makerworld', name: 'MakerWorld', dot: '#FF6900', state: 'blocked', detail: 'Requires a physical print photo', progress: 0 },
];

export const PREFLIGHT = [
  { id: 'files', label: 'Model files present and readable', state: 'pass', detail: '2 STL, 1 3MF' },
  { id: 'cover', label: 'Cover image set', state: 'pass', detail: 'cover-render.webp' },
  { id: 'title', label: 'Title and summary within platform limits', state: 'pass', detail: 'Longest limit: Thingiverse 255' },
  { id: 'profile', label: 'Print profile suitability', state: 'warn', detail: 'Bundled 3MF is unsliced; it uploads as a plain model file' },
  { id: 'photo', label: 'Real print photo for MakerWorld and MakerRoad', state: 'fail', detail: 'Synthetic renders are rejected by platform review' },
];
