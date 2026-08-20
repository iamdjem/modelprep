import { describe, it, expect } from 'vitest';
import { makeDemoStl } from './demo-stl';

describe('makeDemoStl', () => {
  it('emits a structurally valid binary STL with the declared triangle count', () => {
    const buffer = makeDemoStl({ diameter: 22, height: 3.2, segments: 120 });
    const view = new DataView(buffer);
    const triCount = view.getUint32(80, true);
    expect(buffer.byteLength).toBe(84 + triCount * 50);
    // 6 triangles per segment: bottom fan, 2x side quad, 2x chamfer quad, top fan.
    expect(triCount).toBe(120 * 6);
  });

  it('stays within the stated dimensions and sits on z=0', () => {
    const buffer = makeDemoStl({ diameter: 30, height: 4, segments: 32 });
    const view = new DataView(buffer);
    const triCount = view.getUint32(80, true);
    let minZ = Infinity; let maxZ = -Infinity; let maxR = 0;
    for (let t = 0; t < triCount; t += 1) {
      for (let v = 0; v < 3; v += 1) {
        const base = 84 + t * 50 + 12 + v * 12;
        const x = view.getFloat32(base, true);
        const y = view.getFloat32(base + 4, true);
        const z = view.getFloat32(base + 8, true);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        maxR = Math.max(maxR, Math.hypot(x, y));
      }
    }
    expect(minZ).toBe(0);
    expect(maxZ).toBeCloseTo(4, 5);
    expect(maxR).toBeLessThanOrEqual(15.000001);
  });

  it('is a real multi-kilobyte model, not a placeholder blob', () => {
    expect(makeDemoStl().byteLength).toBeGreaterThan(10_000);
  });
});
