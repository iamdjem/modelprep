import { describe, expect, it } from 'vitest';
import { crealityRawModelFiles, crealityUsesRenderedModelCover } from './creality.js';

describe('Creality model preview payload', () => {
  it('omits rendered covers for the formats skipped by Creality Cloud', () => {
    expect(crealityUsesRenderedModelCover('part.stl')).toBe(true);
    expect(crealityUsesRenderedModelCover('part.obj')).toBe(true);
    expect(crealityUsesRenderedModelCover('profile.3mf')).toBe(false);
    expect(crealityUsesRenderedModelCover('assembly.step')).toBe(false);
    expect(crealityUsesRenderedModelCover('assembly.STP')).toBe(false);
  });

  it('keeps ordinary 3MF models but excludes project print profiles from the raw-model mode', () => {
    const files = [
      { id: 'stl', name: 'part.stl', blob: {} },
      { id: 'ordinary', name: 'mesh.3mf', blob: {} },
      { id: 'profile', name: 'bambu-profile.3mf', blob: {} },
    ];
    expect(crealityRawModelFiles(files, [{ fileId: 'profile' }]).map((file) => file.id))
      .toEqual(['stl', 'ordinary']);
  });
});
