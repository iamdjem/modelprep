import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUOTA_BYTES,
  estimateDataUrlBytes,
  planEviction,
  projectStorageKey,
  recordBytes,
  rehydrateProject,
  serializeProjectBinaries,
} from './project-store.js';

const blob = (bytes) => ({ size: bytes });   // stand-in; only `size` is read here
const record = (key, savedAt, bytes) => ({ key, savedAt, files: [{ id: 'f', size: bytes }], images: [] });

describe('size accounting', () => {
  it('adds up files and images', () => {
    expect(recordBytes({ files: [{ size: 10 }, { size: 5 }], images: [{ size: 2 }] })).toBe(17);
  });

  it('treats a missing or malformed record as empty rather than NaN', () => {
    expect(recordBytes(null)).toBe(0);
    expect(recordBytes({})).toBe(0);
    expect(recordBytes({ files: [{}], images: [{}] })).toBe(0);
  });

  it('estimates data-URL bytes from the base64 payload', () => {
    expect(estimateDataUrlBytes('data:image/png;base64,AAAA')).toBe(3);
    expect(estimateDataUrlBytes('not a data url')).toBe(0);
    expect(estimateDataUrlBytes(null)).toBe(0);
  });
});

describe('eviction policy', () => {
  it('keeps everything while under quota', () => {
    const plan = planEviction([record('a', 1, 10), record('b', 2, 10)], { quota: 100 });
    expect(plan.evict).toEqual([]);
    expect(plan.overQuota).toBe(false);
  });

  it('drops the oldest first, and only as many as needed', () => {
    const plan = planEviction(
      [record('old', 1, 60), record('mid', 2, 60), record('new', 3, 60)],
      { quota: 130 },
    );
    expect(plan.evict).toEqual(['old']);
  });

  // The project being saved must survive: evicting it to make room for itself
  // would lose exactly the work the user is doing.
  it('never evicts the project being saved', () => {
    const plan = planEviction(
      [record('current', 1, 200), record('other', 2, 50)],
      { quota: 100, keepKey: 'current' },
    );
    expect(plan.evict).toEqual(['other']);
    expect(plan.evict).not.toContain('current');
  });

  it('reports when even the kept project exceeds quota, instead of silently storing nothing', () => {
    const plan = planEviction([record('current', 1, 500)], { quota: 100, keepKey: 'current' });
    expect(plan.evict).toEqual([]);
    expect(plan.overQuota).toBe(true);
  });

  it('has a quota large enough for real projects but not a whole disk', () => {
    expect(DEFAULT_QUOTA_BYTES).toBeGreaterThan(1024 ** 3);
    expect(DEFAULT_QUOTA_BYTES).toBeLessThanOrEqual(8 * 1024 ** 3);
  });
});

describe('storage key', () => {
  it('is stable and case-insensitive', () => {
    expect(projectStorageKey({ name: 'Desk Dragon' })).toBe('desk dragon');
    expect(projectStorageKey({ name: '  Desk Dragon  ' })).toBe('desk dragon');
  });

  it('prefers an explicit id over a renamable title', () => {
    expect(projectStorageKey({ storageId: 'p-1', name: 'Anything' })).toBe('p-1');
  });

  it('always yields a key, even for an empty project', () => {
    expect(projectStorageKey({})).toBe('untitled');
    expect(projectStorageKey(null)).toBe('untitled');
    expect(projectStorageKey({ name: '   ' })).toBe('untitled');
  });
});

describe('serialising binaries', () => {
  const project = {
    files: [
      { id: 'a', name: 'a.stl', size: 10, blob: blob(10), isModel: true },
      { id: 'b', name: 'b.3mf', size: 20, blob: blob(20), isProfile: true, threemf: { slicer: 'bambu' } },
      { id: 'c', name: 'c.stl', size: 5 },                       // no blob: nothing to store
    ],
    images: [
      { id: 'i1', blob: blob(7), alt: 'one', focal: { x: 0.2, y: 0.3 } },
      { id: 'i2', dataUrl: 'data:image/png;base64,AAAAAAAA' },
    ],
  };

  it('keeps only what has bytes behind it', () => {
    const out = serializeProjectBinaries(project);
    expect(out.files.map((f) => f.id)).toEqual(['a', 'b']);
    expect(out.images.map((i) => i.id)).toEqual(['i1', 'i2']);
  });

  it('preserves the metadata the app needs to rebuild a file', () => {
    const { files } = serializeProjectBinaries(project);
    expect(files[1]).toMatchObject({ name: 'b.3mf', isProfile: true, threemf: { slicer: 'bambu' } });
  });

  it('sizes a data-URL image so it counts against quota', () => {
    const { images } = serializeProjectBinaries(project);
    expect(images[1].size).toBeGreaterThan(0);
  });

  it('handles an empty project without throwing', () => {
    expect(serializeProjectBinaries({})).toEqual({ files: [], images: [] });
    expect(serializeProjectBinaries(null)).toEqual({ files: [], images: [] });
  });
});

describe('rehydrating', () => {
  const stored = {
    files: [{ id: 'a', name: 'a.stl', size: 10, blob: blob(10) }],
    images: [{ id: 'i1', blob: blob(7), focal: { x: 0.5, y: 0.5 } }],
  };

  it('puts the files and images back', () => {
    const out = rehydrateProject({ files: [], images: [], profiles: [] }, stored);
    expect(out.files).toHaveLength(1);
    expect(out.images).toHaveLength(1);
  });

  // A profile pointing at a file that is no longer stored would pass pre-flight
  // and then fail mid-upload, which is worse than not being there at all.
  it('drops profiles whose file did not survive', () => {
    const out = rehydrateProject(
      { profiles: [{ id: 'p1', fileId: 'a' }, { id: 'p2', fileId: 'gone' }] },
      stored,
    );
    expect(out.profiles.map((p) => p.id)).toEqual(['p1']);
  });

  it('repairs a cover pointing at an image that is gone', () => {
    const out = rehydrateProject({ coverImageId: 'missing', profiles: [] }, stored);
    expect(out.coverImageId).toBe('i1');
  });

  it('keeps a cover that is still there', () => {
    const out = rehydrateProject({ coverImageId: 'i1', profiles: [] }, stored);
    expect(out.coverImageId).toBe('i1');
  });

  it('returns the project untouched when there is nothing stored', () => {
    const project = { files: [{ id: 'x' }] };
    expect(rehydrateProject(project, null)).toBe(project);
  });
});
