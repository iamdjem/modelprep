// STL thumbnails, rendered from the mesh itself.
//
// A .3mf carries the slicer's own plate render, so its preview is just an
// extracted PNG. An .stl carries nothing but triangles, so the only way to show
// a maker what a file contains is to draw it.
//
// Everything here is pure: parse triangles out of a buffer, then rasterise them
// into an RGBA pixel array. No canvas, no DOM, no WebGL — which means it runs
// unchanged inside a worker (where the parse belongs, since real model files run
// to millions of triangles) and can be tested in Node without a browser.
//
// The renderer is deliberately plain: one orthographic camera, flat Lambert
// shading, a z-buffer. At 96px a thumbnail only has to answer "what shape is
// this and is it the right model", and anything fancier would cost bundle
// weight for detail nobody can see at that size.

// Above this, triangles are sampled by striding rather than dropped from one
// region, so the silhouette stays representative.
export const DEFAULT_TRIANGLE_BUDGET = 40_000;

const BINARY_HEADER_BYTES = 84;   // 80-byte header + uint32 triangle count
const BINARY_TRIANGLE_BYTES = 50; // normal + 3 vertices + attribute count

/** Does this buffer's length match the triangle count a binary STL declares? */
export function isBinaryStl(buffer) {
  if (!buffer || buffer.byteLength < BINARY_HEADER_BYTES) return false;
  const count = new DataView(buffer).getUint32(80, true);
  return buffer.byteLength === BINARY_HEADER_BYTES + count * BINARY_TRIANGLE_BYTES;
}

/**
 * Triangle vertices as a flat Float32Array, 9 floats per triangle.
 * Handles both binary and ASCII STL. Returns an empty array for anything
 * unreadable rather than throwing: a malformed file must never break an import.
 */
export function parseStlTriangles(buffer, { budget = DEFAULT_TRIANGLE_BUDGET } = {}) {
  if (!buffer || !buffer.byteLength) return new Float32Array(0);
  return isBinaryStl(buffer)
    ? parseBinary(buffer, budget)
    : parseAscii(buffer, budget);
}

function parseBinary(buffer, budget) {
  const view = new DataView(buffer);
  const total = view.getUint32(80, true);
  if (!total) return new Float32Array(0);
  const stride = Math.max(1, Math.ceil(total / budget));
  const kept = Math.ceil(total / stride);
  const out = new Float32Array(kept * 9);
  let w = 0;
  for (let i = 0; i < total; i += stride) {
    // +12 skips the stored normal: it is unreliable in the wild, so normals are
    // recomputed from the winding at render time.
    let o = BINARY_HEADER_BYTES + i * BINARY_TRIANGLE_BYTES + 12;
    for (let p = 0; p < 9; p += 1) { out[w++] = view.getFloat32(o, true); o += 4; }
  }
  return out.subarray(0, w);
}

function parseAscii(buffer, budget) {
  let text;
  try { text = new TextDecoder().decode(buffer); } catch { return new Float32Array(0); }
  if (!/facet\s+normal/i.test(text)) return new Float32Array(0);
  const numbers = [];
  const vertex = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let match;
  while ((match = vertex.exec(text)) !== null) {
    numbers.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  const total = Math.floor(numbers.length / 9);
  if (!total) return new Float32Array(0);
  const stride = Math.max(1, Math.ceil(total / budget));
  const out = new Float32Array(Math.ceil(total / stride) * 9);
  let w = 0;
  for (let i = 0; i < total; i += stride) {
    for (let p = 0; p < 9; p += 1) out[w++] = numbers[i * 9 + p];
  }
  return out.subarray(0, w);
}

/** Axis-aligned bounds, used to centre and scale the model into the frame. */
export function meshBounds(tris) {
  if (!tris || !tris.length) return null;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < tris.length; i += 3) {
    const x = tris[i], y = tris[i + 1], z = tris[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/**
 * Rasterise the mesh into an RGBA buffer of `size` × `size`.
 *
 * A fixed three-quarter view, the same for every model, so a row of thumbnails
 * is comparable. Returns transparent pixels where nothing was drawn, letting the
 * tile's own background show through.
 */
export function renderStlThumbnail(tris, options = {}) {
  const size = Math.max(8, Math.floor(options.size || 96));
  // Light ink: the tile behind an STL is the same near-black as the 3MF plate
  // renders, so drawing in ink colour produced a black shape on a black plate.
  const ink = options.ink || [232, 228, 217];
  const data = new Uint8ClampedArray(size * size * 4);
  const bounds = meshBounds(tris);
  if (!bounds) return { data, size };

  // Centre, then scale the longest axis to fill most of the frame.
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, bounds.maxZ - bounds.minZ) || 1;
  const scale = (size * 0.78) / span;

  // Yaw then pitch: a three-quarter view reads as solid, where a face-on
  // orthographic view of a flat-bottomed print is an ambiguous rectangle.
  const yaw = -Math.PI / 5;
  const pitch = -Math.PI / 5.5;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const project = (x, y, z) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const rx = dx * cosY - dy * sinY;
    const ry = dx * sinY + dy * cosY;
    // Z is up in the print world, so it maps to screen -Y.
    const rz = dz;
    const sy = ry * cosP - rz * sinP;
    const depth = ry * sinP + rz * cosP;
    return { x: size / 2 + rx * scale, y: size / 2 - sy * scale, z: depth };
  };

  const light = normalise([-0.35, -0.5, 0.78]);
  const depthBuffer = new Float32Array(size * size).fill(Infinity);

  for (let t = 0; t < tris.length; t += 9) {
    const a = project(tris[t], tris[t + 1], tris[t + 2]);
    const b = project(tris[t + 3], tris[t + 4], tris[t + 5]);
    const c = project(tris[t + 6], tris[t + 7], tris[t + 8]);

    const normal = normalise(cross(
      [tris[t + 3] - tris[t], tris[t + 4] - tris[t + 1], tris[t + 5] - tris[t + 2]],
      [tris[t + 6] - tris[t], tris[t + 7] - tris[t + 1], tris[t + 8] - tris[t + 2]],
    ));
    if (!normal) continue;
    // Two-sided: STL winding is often inconsistent, and a thumbnail showing
    // holes where a normal points the wrong way looks like a broken model.
    const lambert = Math.abs(normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
    const shade = 0.30 + 0.70 * lambert;

    rasterise(data, depthBuffer, size, a, b, c, ink, shade);
  }
  return { data, size };
}

function rasterise(data, depthBuffer, size, a, b, c, ink, shade) {
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
  if (minX > maxX || minY > maxY) return;

  const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(area) < 1e-9) return;   // degenerate, contributes nothing

  const r = Math.round(ink[0] * shade);
  const g = Math.round(ink[1] * shade);
  const bl = Math.round(ink[2] * shade);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5, py = y + 0.5;
      // Barycentric coverage test.
      let w0 = ((b.x - a.x) * (py - a.y) - (px - a.x) * (b.y - a.y)) / area;
      let w1 = ((px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const depth = a.z * w2 + b.z * w1 + c.z * w0;
      const index = y * size + x;
      if (depth >= depthBuffer[index]) continue;   // something nearer is already here
      depthBuffer[index] = depth;
      const o = index * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = bl; data[o + 3] = 255;
    }
  }
}

function cross(u, v) {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

function normalise(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!length || !Number.isFinite(length)) return null;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** One call: buffer in, pixels out. This is what the worker runs. */
export function stlThumbnailFromBuffer(buffer, options = {}) {
  const tris = parseStlTriangles(buffer, options);
  if (!tris.length) return null;
  return { ...renderStlThumbnail(tris, options), bounds: meshBounds(tris) };
}
