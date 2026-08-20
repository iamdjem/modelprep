import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildPlateCameraPreset,
  buildPlateGridSegments,
  orientStlForBuildPlate,
  resolveBuildPlateProfile,
} from './interactive-build-plate.js';

describe('interactive build plate geometry', () => {
  it('converts STL Z-up coordinates to a centred Y-up plate mesh', () => {
    const triangle = new Float32Array([
      0, 0, -2,
      10, 0, 3,
      0, 20, -2,
    ]);
    const mesh = orientStlForBuildPlate(triangle);
    expect(mesh.width).toBe(10);
    expect(mesh.depth).toBe(20);
    expect(mesh.height).toBe(5);
    expect([...mesh.positions]).toEqual([
      -5, 0, 10,
      5, 5, 10,
      -5, 0, -10,
    ]);
  });

  it('fails closed for an empty mesh', () => {
    expect(orientStlForBuildPlate(new Float32Array())).toBeNull();
  });

  it('offers isometric, top, and front camera presets around the same target', () => {
    const iso = buildPlateCameraPreset(100, 20, 'iso');
    const top = buildPlateCameraPreset(100, 20, 'top');
    const front = buildPlateCameraPreset(100, 20, 'front');
    expect(iso.target).toEqual([0, 4.8, 0]);
    expect(top.target).toEqual(iso.target);
    expect(front.target).toEqual(iso.target);
    expect(iso.position[0]).toBeGreaterThan(0);
    expect(top.position[1]).toBeGreaterThan(front.position[1]);
    expect(front.position[2]).toBeGreaterThan(iso.position[2]);
  });

  it('uses the distinct A1 mini physical sheet around its 180 mm printable area', () => {
    const profile = resolveBuildPlateProfile({ printer: 'Bambu Lab A1 mini', fallbackSize: 50 });
    expect(profile.id).toBe('bambu-a1-mini');
    expect(profile.native).toBe(true);
    expect(profile.printable).toEqual({ width: 180, depth: 180 });
    expect(profile.physical).toEqual({ width: 184, depth: 197.13, thickness: 0.6 });
    expect(Math.min(...profile.outline.map(([x]) => x))).toBeCloseTo(-92);
    expect(Math.max(...profile.outline.map(([x]) => x))).toBeCloseTo(92);
    expect(Math.min(...profile.outline.map(([, y]) => y))).toBeCloseTo(-99.13);
    expect(Math.max(...profile.outline.map(([, y]) => y))).toBeCloseTo(98);
    expect(profile.rearSlot).toBeNull();
  });

  it('uses the X1-family sheet and rear slot for compatible Bambu printers', () => {
    const profile = resolveBuildPlateProfile({ printer: 'Bambu Lab P1S' });
    expect(profile.id).toBe('bambu-x1-family');
    expect(profile.printable).toEqual({ width: 256, depth: 256 });
    expect(profile.physical).toEqual({ width: 258, depth: 276, thickness: 0.4 });
    expect(Math.min(...profile.outline.map(([x]) => x))).toBeCloseTo(-128);
    expect(Math.max(...profile.outline.map(([x]) => x))).toBeCloseTo(130);
    expect(profile.rearSlot).toEqual({ width: 44.14, depth: 2, x: 1, y: 131 });
  });

  it('keeps an auto-fit generic fallback when no printer is known', () => {
    const profile = resolveBuildPlateProfile({ fallbackSize: 50 });
    expect(profile.id).toBe('generic');
    expect(profile.native).toBe(false);
    expect(profile.printable).toEqual({ width: 50, depth: 50 });
    expect(profile.physical.width).toBe(50);
  });

  it('builds a world-space 10 mm grid with every fifth line promoted', () => {
    const profile = resolveBuildPlateProfile({ printer: 'Bambu Lab A1 Mini' });
    const grid = buildPlateGridSegments(profile);
    expect(grid.major).toHaveLength(16);
    expect(grid.minor).toHaveLength(60);
    expect(grid.major).toContainEqual([-90, -90]);
    expect(grid.major).toContainEqual([-90, 90]);
    expect(grid.minor).toContainEqual([-80, -90]);
  });

  it('renders one physical plate cap instead of overlapping coplanar surfaces', () => {
    const component = readFileSync(new URL('../components/InteractiveBuildPlate.jsx', import.meta.url), 'utf8');
    expect(component).toContain('const plateGeometry = new THREE.ExtrudeGeometry');
    expect(component).not.toContain('new THREE.ShapeGeometry(plateShape');
  });
});

