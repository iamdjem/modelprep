// Real, printable binary STL for the demo/test fixture. The old fixture used
// ~45-byte text blobs posing as multi-MB STLs, which planted unprintable junk
// on every live platform (and was publicly downloadable during the Nexprint
// exposure). This generates a genuine watertight model instead: a faceted
// coin/tag with a chamfered top edge — flat base, no overhangs, printable
// support-free on any FDM printer.

function writeTriangle(view, offset, normal, a, b, c) {
  const put = (base, [x, y, z]) => {
    view.setFloat32(base, x, true);
    view.setFloat32(base + 4, y, true);
    view.setFloat32(base + 8, z, true);
  };
  put(offset, normal);
  put(offset + 12, a);
  put(offset + 24, b);
  put(offset + 36, c);
  view.setUint16(offset + 48, 0, true);
  return offset + 50;
}

function normalOf(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

// Returns an ArrayBuffer holding a valid binary STL.
export function makeDemoStl({ diameter = 30, height = 4, segments = 96, chamfer = 0.8 } = {}) {
  const r = diameter / 2;
  const rTop = r - chamfer;
  const zChamfer = height - chamfer;
  const ring = (radius, z) => Array.from({ length: segments }, (_, i) => {
    const t = (i / segments) * Math.PI * 2;
    return [radius * Math.cos(t), radius * Math.sin(t), z];
  });
  const base = ring(r, 0);
  const mid = ring(r, zChamfer);
  const top = ring(rTop, height);
  const tris = [];
  const quad = (a, b, c, d) => { tris.push([a, b, c], [a, c, d]); };
  for (let i = 0; i < segments; i += 1) {
    const j = (i + 1) % segments;
    // bottom fan (normal -z): wind clockwise viewed from +z
    tris.push([[0, 0, 0], base[j], base[i]]);
    // side wall and chamfer band
    quad(base[i], base[j], mid[j], mid[i]);
    quad(mid[i], mid[j], top[j], top[i]);
    // top fan (+z)
    tris.push([[0, 0, height], top[i], top[j]]);
  }
  const buffer = new ArrayBuffer(84 + tris.length * 50);
  const view = new DataView(buffer);
  const header = 'ModelPrep demo tag — real printable binary STL';
  for (let i = 0; i < Math.min(80, header.length); i += 1) view.setUint8(i, header.charCodeAt(i) & 0x7f);
  view.setUint32(80, tris.length, true);
  let offset = 84;
  for (const [a, b, c] of tris) offset = writeTriangle(view, offset, normalOf(a, b, c), a, b, c);
  return buffer;
}
