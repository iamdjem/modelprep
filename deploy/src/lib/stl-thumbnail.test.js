import { describe, expect, it } from 'vitest';
import {
  isBinaryStl,
  meshBounds,
  parseStlTriangles,
  renderStlThumbnail,
  stlThumbnailFromBuffer,
} from './stl-thumbnail.js';

// A unit cube as a binary STL: 12 triangles, the shape most likely to expose a
// projection or winding mistake because every face is axis-aligned.
function binaryCube({ triangles = null } = {}) {
  const v = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const faces = triangles || [
    [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1],
    [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0],
  ];
  const buffer = new ArrayBuffer(84 + faces.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, faces.length, true);
  let o = 84;
  for (const face of faces) {
    view.setFloat32(o, 0, true); view.setFloat32(o + 4, 0, true); view.setFloat32(o + 8, 1, true);
    o += 12;
    for (const idx of face) {
      view.setFloat32(o, v[idx][0], true);
      view.setFloat32(o + 4, v[idx][1], true);
      view.setFloat32(o + 8, v[idx][2], true);
      o += 12;
    }
    view.setUint16(o, 0, true); o += 2;
  }
  return buffer;
}

const asciiTetra = `solid t
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1 0
  endloop
endfacet
facet normal 0 1 0
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 0 1
  endloop
endfacet
endsolid t`;

const encode = (text) => new TextEncoder().encode(text).buffer;
const opaquePixels = ({ data }) => {
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n += 1;
  return n;
};

describe('STL parsing', () => {
  it('recognises a binary STL by its declared triangle count', () => {
    expect(isBinaryStl(binaryCube())).toBe(true);
    expect(isBinaryStl(encode(asciiTetra))).toBe(false);
    expect(isBinaryStl(new ArrayBuffer(4))).toBe(false);
    expect(isBinaryStl(null)).toBe(false);
  });

  it('reads every vertex of a binary cube', () => {
    const tris = parseStlTriangles(binaryCube());
    expect(tris.length).toBe(12 * 9);
    expect(meshBounds(tris)).toMatchObject({ minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 });
  });

  it('reads ASCII STL, which slicers and CAD exports still emit', () => {
    const tris = parseStlTriangles(encode(asciiTetra));
    expect(tris.length).toBe(2 * 9);
    expect(meshBounds(tris)).toMatchObject({ maxX: 1, maxZ: 1 });
  });

  it('samples by striding rather than truncating, so the silhouette survives', () => {
    const tris = parseStlTriangles(binaryCube(), { budget: 4 });
    expect(tris.length / 9).toBeLessThanOrEqual(4);
    // Striding keeps faces from all round the cube, so the bounds stay full.
    const bounds = meshBounds(tris);
    expect(bounds.maxX).toBe(1);
    expect(bounds.maxZ).toBe(1);
  });

  it('returns nothing for junk instead of throwing, so an import cannot break', () => {
    expect(parseStlTriangles(encode('not a model at all')).length).toBe(0);
    expect(parseStlTriangles(new ArrayBuffer(0)).length).toBe(0);
    expect(parseStlTriangles(null).length).toBe(0);
    expect(parseStlTriangles(undefined).length).toBe(0);
  });
});

describe('STL thumbnail rendering', () => {
  it('draws the model into the frame', () => {
    const result = stlThumbnailFromBuffer(binaryCube(), { size: 64 });
    expect(result.size).toBe(64);
    expect(result.data.length).toBe(64 * 64 * 4);
    const painted = opaquePixels(result);
    // A cube at this camera covers a good share of the frame but never all of it.
    expect(painted).toBeGreaterThan(64 * 64 * 0.2);
    expect(painted).toBeLessThan(64 * 64 * 0.9);
  });

  it('leaves the background transparent so the tile shows through', () => {
    const { data } = stlThumbnailFromBuffer(binaryCube(), { size: 32 });
    expect(data[3]).toBe(0);                        // top-left corner is empty
  });

  it('shades faces differently, which is what makes it read as a solid', () => {
    const { data } = stlThumbnailFromBuffer(binaryCube(), { size: 64 });
    const shades = new Set();
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) shades.add(data[i]);
    expect(shades.size).toBeGreaterThan(1);
  });

  it('keeps the model inside the canvas whatever its coordinates', () => {
    // A mesh far from the origin must still be centred, not clipped away.
    const buffer = binaryCube();
    const view = new DataView(buffer);
    for (let t = 0; t < 12; t += 1) {
      let o = 84 + t * 50 + 12;
      for (let p = 0; p < 9; p += 1) { view.setFloat32(o, view.getFloat32(o, true) + 500, true); o += 4; }
    }
    expect(opaquePixels(stlThumbnailFromBuffer(buffer, { size: 48 }))).toBeGreaterThan(0);
  });

  it('renders a single triangle without dividing by a zero area', () => {
    const buffer = binaryCube({ triangles: [[0, 1, 2]] });
    expect(() => stlThumbnailFromBuffer(buffer, { size: 32 })).not.toThrow();
  });

  it('returns null when there is nothing to draw', () => {
    expect(stlThumbnailFromBuffer(encode('junk'), { size: 32 })).toBeNull();
    expect(stlThumbnailFromBuffer(new ArrayBuffer(0))).toBeNull();
  });

  it('never writes outside the buffer for a degenerate mesh', () => {
    const flat = binaryCube({ triangles: [[0, 1, 0], [0, 0, 0]] });
    const { data, size } = stlThumbnailFromBuffer(flat, { size: 16 }) || { data: new Uint8ClampedArray(0), size: 16 };
    expect(data.length).toBe(size * size * 4);
  });
});
