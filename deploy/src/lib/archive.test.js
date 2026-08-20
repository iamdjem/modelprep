import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { inspectArchive } from './archive.js';

describe('ZIP browsing', () => {
  it('lists nested model and documentation entries without extracting them', async () => {
    const zip = new JSZip();
    zip.file('models/body.stl', 'solid body');
    zip.file('README.md', '# print');
    const blob = await zip.generateAsync({ type: 'uint8array' });
    const result = await inspectArchive(blob, async () => JSZip);
    expect(result.error).toBeNull();
    expect(result.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'models/body.stl', role: 'model' }),
      expect.objectContaining({ name: 'README.md', role: 'documentation' }),
    ]));
  });
});
