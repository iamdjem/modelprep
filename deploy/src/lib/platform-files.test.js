import { describe, expect, it } from 'vitest';
import { autoExcludedFileIds, isAutoFileSelection, isFileExcluded, sameIdSet, toggleExcludedFileId, withoutExcluded } from './platform-files.js';

const files = [{ id: 'a', name: 'a.stl' }, { id: 'b', name: 'b.3mf' }, { id: 'c', name: 'c.3mf' }];

describe('per-platform file exclusions', () => {
  it('is a strict no-op when no exclusions exist (certified-flow invariant)', () => {
    expect(withoutExcluded(files, undefined)).toBe(files);
    expect(withoutExcluded(files, {})).toBe(files);
    expect(withoutExcluded(files, { excludedFileIds: [] })).toBe(files);
  });

  it('removes exactly the excluded files', () => {
    const kept = withoutExcluded(files, { excludedFileIds: ['b'] });
    expect(kept.map((f) => f.id)).toEqual(['a', 'c']);
    expect(isFileExcluded(files[1], { excludedFileIds: ['b'] })).toBe(true);
    expect(isFileExcluded(files[0], { excludedFileIds: ['b'] })).toBe(false);
  });

  it('toggles ids in and out of the exclusion list', () => {
    let opts = { excludedFileIds: [] };
    opts = { excludedFileIds: toggleExcludedFileId(opts, 'b') };
    expect(opts.excludedFileIds).toEqual(['b']);
    opts = { excludedFileIds: toggleExcludedFileId(opts, 'b') };
    expect(opts.excludedFileIds).toEqual([]);
  });
});

// --- Slicer attribution -----------------------------------------------------
// A project holding one model sliced several ways should not push every profile
// to every platform. Each vendor slicer maps to that vendor's platform.

const profile = (id, slicer) => ({ id, name: `${id}.3mf`, isProfile: true, threemf: { slicer } });
const geometry = (id, name) => ({ id, name, isProfile: false });

const mixed = [
  geometry('stl', 'ram.stl'),
  geometry('step', 'ram.step'),
  profile('bambu', 'bambu'),
  profile('creality', 'crealityprint'),
  profile('anycubic', 'anycubic'),
  profile('elegoo', 'elegoo'),
  profile('prusa', 'prusa'),
];

const includedIds = (platformId) => {
  const excluded = autoExcludedFileIds(platformId, mixed);
  return withoutExcluded(mixed, { excludedFileIds: excluded }).map((f) => f.id);
};

describe('automatic slicer-to-platform attribution', () => {
  it('keeps only the platform vendor\'s own profiles, plus neutral geometry', () => {
    expect(includedIds('makerworld')).toEqual(['stl', 'step', 'bambu']);
    expect(includedIds('creality')).toEqual(['stl', 'step', 'creality']);
    expect(includedIds('makeronline')).toEqual(['stl', 'step', 'anycubic']);
    expect(includedIds('printables')).toEqual(['stl', 'step', 'prusa']);
  });

  it('gives both Elegoo platforms the Elegoo profile', () => {
    expect(includedIds('nexprint')).toContain('elegoo');
    expect(includedIds('makeroad')).toContain('elegoo');
    expect(includedIds('nexprint')).not.toContain('bambu');
  });

  it('never excludes anything for platforms without a slicer of their own', () => {
    for (const id of ['cults', 'thingiverse', 'mmf', 'thangs']) {
      expect(autoExcludedFileIds(id, mixed)).toEqual([]);
    }
  });

  it('treats community slicers and undetected files as neutral, never dropping them', () => {
    const neutral = [profile('orca', 'orca'), profile('cura', 'cura'), profile('mystery', 'unknown'), { id: 'raw', name: 'r.3mf', isProfile: true }];
    expect(autoExcludedFileIds('makerworld', neutral)).toEqual([]);
  });

  it('excludes nothing when there is no file to attribute', () => {
    expect(autoExcludedFileIds('makerworld', [])).toEqual([]);
    expect(autoExcludedFileIds('makerworld', undefined)).toEqual([]);
  });

  it('treats a platform as automatic until the user picks manually', () => {
    expect(isAutoFileSelection(undefined)).toBe(true);
    expect(isAutoFileSelection({})).toBe(true);
    expect(isAutoFileSelection({ fileSelection: 'auto' })).toBe(true);
    expect(isAutoFileSelection({ fileSelection: 'manual' })).toBe(false);
  });

  it('settles after one pass, so the auto-sync effect cannot loop', () => {
    // The effect writes only when the computed set differs from the stored one.
    // Recomputing over already-synced options must therefore be a no-op.
    const first = autoExcludedFileIds('makerworld', mixed);
    const second = autoExcludedFileIds('makerworld', mixed);
    expect(sameIdSet(first, second)).toBe(true);
    expect(sameIdSet(autoExcludedFileIds('cults', mixed), [])).toBe(true);
  });

  it('compares id sets regardless of order, so re-syncing does not loop', () => {
    expect(sameIdSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIdSet([], undefined)).toBe(true);
    expect(sameIdSet(['a'], ['a', 'b'])).toBe(false);
  });
});
