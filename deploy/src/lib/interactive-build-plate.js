import { meshBounds } from './stl-thumbnail.js';

// STL uses Z-up coordinates while Three.js uses Y-up. Reorient the sampled
// triangles, centre them on the plate, and put their lowest point on Y=0.
// Keeping this pure makes the geometry contract testable without WebGL.
export function orientStlForBuildPlate(triangles) {
  const bounds = meshBounds(triangles);
  if (!bounds) return null;
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  const positions = new Float32Array(triangles.length);
  for (let i = 0; i < triangles.length; i += 3) {
    positions[i] = triangles[i] - centreX;
    positions[i + 1] = triangles[i + 2] - bounds.minZ;
    positions[i + 2] = -(triangles[i + 1] - centreY);
  }
  return {
    positions,
    width: bounds.maxX - bounds.minX,
    depth: bounds.maxY - bounds.minY,
    height: bounds.maxZ - bounds.minZ,
  };
}

export function buildPlateCameraPreset(plateSize, modelHeight = 0, view = 'iso') {
  const size = Math.max(1, Number(plateSize) || 1);
  const target = [0, Math.max(0, modelHeight) * 0.24, 0];
  if (view === 'top') return { position: [0, size * 1.92, 0.01], target };
  if (view === 'front') return { position: [0, size * 0.72, size * 1.82], target };
  return { position: [size * 1.04, size * 1.12, size * 1.52], target };
}

const arc = (cx, cy, radius, start, end, steps = 6) => Array.from({ length: steps + 1 }, (_, index) => {
  const angle = start + ((end - start) * index) / steps;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
});

function x1FamilyOutline() {
  // Clean-room profile of the functional X1/P1 sheet geometry. Coordinates
  // use the 256 mm printable-area centre as the origin. Unlike the previous
  // visual guess, the physical sheet is 258 x 276 mm, with a centred rear
  // handle and the asymmetric front lead-in visible in Bambu Studio.
  return [
    [-23.93, 138], [25.93, 138], [38.07, 130], [122.5, 130],
    ...arc(122.5, 122.5, 7.5, Math.PI / 2, 0),
    [130, -130.5],
    ...arc(122.5, -130.5, 7.5, 0, -Math.PI / 2),
    [-43.93, -138], [-58.07, -128], [-120.5, -128],
    ...arc(-120.5, -120.5, 7.5, -Math.PI / 2, -Math.PI),
    [-128, 122.5],
    ...arc(-120.5, 122.5, 7.5, Math.PI, Math.PI / 2),
    [-36.07, 130], [-23.93, 138],
  ];
}

function a1MiniOutline() {
  // A1 mini uses a distinct 180 mm bed. Its physical sheet is asymmetric at
  // the front and has two rear locating wings; it must not reuse the X1 shape.
  return [
    [-90, -92], [-42.13, -92], [-32.04, -99.13], [90, -99.13],
    ...arc(90, -97.13, 2, -Math.PI / 2, 0),
    [92, 90], ...arc(90, 90, 2, 0, Math.PI / 2),
    [58.93, 92], [52.98, 97.12], [50.86, 98], [30.34, 98], [28.22, 97.12], [24.27, 93.17],
    [23.67, 92], [-21.44, 92], [-22.03, 93.17], [-25.98, 97.12], [-28.14, 98], [-50.86, 98],
    [-52.98, 97.12], [-57.51, 92.59], [-58.93, 92], [-90, 92],
    ...arc(-90, 90, 2, Math.PI / 2, Math.PI), [-92, 0],
    ...arc(-90, 0, 2, Math.PI, Math.PI * 1.5), [-90, -92],
  ];
}

function roundedGenericOutline(size) {
  const half = size / 2;
  const radius = Math.min(6, size * 0.025);
  return [
    [-half + radius, -half], [half - radius, -half],
    ...arc(half - radius, -half + radius, radius, -Math.PI / 2, 0),
    [half, half - radius], ...arc(half - radius, half - radius, radius, 0, Math.PI / 2),
    [-half + radius, half], ...arc(-half + radius, half - radius, radius, Math.PI / 2, Math.PI),
    [-half, -half + radius], ...arc(-half + radius, -half + radius, radius, Math.PI, Math.PI * 1.5),
  ];
}

export function resolveBuildPlateProfile({ printer = '', fallbackSize = 256 } = {}) {
  const label = String(printer || '').trim();
  if (/bambu\s+lab\s+a1\s*mini/i.test(label)) {
    return {
      id: 'bambu-a1-mini', native: true, printer: 'Bambu Lab A1 mini', plate: 'Textured PEI Plate',
      printable: { width: 180, depth: 180 }, physical: { width: 184, depth: 197.13, thickness: 0.6 },
      outline: a1MiniOutline(), rearSlot: null,
    };
  }

  if (/bambu\s+lab\s+(?:x1(?:\s+carbon|e)?|p1[ps]|p2s|a1)(?:\b|\s)/i.test(label)) {
    return {
      id: 'bambu-x1-family', native: true, printer: label || 'Bambu Lab X1/P1', plate: 'Textured PEI Plate',
      printable: { width: 256, depth: 256 }, physical: { width: 258, depth: 276, thickness: 0.4 },
      outline: x1FamilyOutline(), rearSlot: { width: 44.14, depth: 2, x: 1, y: 131 },
    };
  }

  const size = Math.max(20, Number(fallbackSize) || 256);
  return {
    id: 'generic', native: false, printer: '', plate: 'Generic preview plate',
    printable: { width: size, depth: size }, physical: { width: size, depth: size, thickness: Math.max(0.8, size * 0.005) },
    outline: roundedGenericOutline(size), rearSlot: null,
  };
}

export function buildPlateGridSegments(profile) {
  const width = profile?.printable?.width;
  const depth = profile?.printable?.depth;
  if (!(width > 0) || !(depth > 0)) return { minor: [], major: [] };
  const minor = [];
  const major = [];
  const push = (collection, a, b) => collection.push(a, b);
  for (let index = 0, x = -width / 2; x <= width / 2 + 1e-6; index += 1, x += 10) {
    push(index % 5 === 0 ? major : minor, [x, -depth / 2], [x, depth / 2]);
  }
  for (let index = 0, y = -depth / 2; y <= depth / 2 + 1e-6; index += 1, y += 10) {
    push(index % 5 === 0 ? major : minor, [-width / 2, y], [width / 2, y]);
  }
  return { minor, major };
}

