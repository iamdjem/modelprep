import { describe, expect, it } from 'vitest';
import { buildPlatePreviewMetrics, formatModelDimension } from './build-plate.js';

describe('slicer build-plate preview metrics', () => {
  it('chooses a readable auto-fit plate without pretending to know the printer', () => {
    const result = buildPlatePreviewMetrics({ minX: 0, maxX: 34, minY: 0, maxY: 34, minZ: 0, maxZ: 4.4 });
    expect(result.plateSize).toBe(50);
    expect(result.dimensions).toEqual({ x: 34, y: 34, z: 4.4 });
    expect(result.modelPercent).toBeGreaterThan(80);
    expect(result.modelPercent).toBeLessThanOrEqual(90);
  });

  it('moves to common larger plate sizes for larger models', () => {
    expect(buildPlatePreviewMetrics({ minX: -90, maxX: 90, minY: -40, maxY: 40, minZ: 0, maxZ: 20 }).plateSize).toBe(256);
  });

  it('fails closed on absent or invalid bounds', () => {
    expect(buildPlatePreviewMetrics(null)).toBeNull();
    expect(buildPlatePreviewMetrics({ minX: 5, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 })).toBeNull();
  });

  it('formats dimensions compactly for slicer chrome', () => {
    expect(formatModelDimension(4.4)).toBe('4.40');
    expect(formatModelDimension(34)).toBe('34.0');
    expect(formatModelDimension(220)).toBe('220');
  });
});

