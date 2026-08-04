import { describe, expect, it } from 'vitest';
import { isFileExcluded, toggleExcludedFileId, withoutExcluded } from './platform-files.js';

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
