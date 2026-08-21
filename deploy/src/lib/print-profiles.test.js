import { describe, expect, it } from 'vitest';
import { fileKeepsPrintProfile, fileTakesPrintProfile } from './print-profiles.js';

const file = (name, threemf) => ({ id: name, name, threemf });
const scanned = (extra) => ({ scanned: true, slicer: 'unknown', sliced: false, ...extra });

describe('which files own a print profile', () => {
  it('takes an unsliced Bambu project, because MakerWorld slices it server-side', () => {
    // The case that made a project unpublishable: MakerWorld's readiness asked
    // for a configured profile while the Profiles step refused to create one.
    // makerworld-web-flow.md, live publish 2026-06-20.
    expect(fileTakesPrintProfile(file('latch.3mf', scanned({ slicer: 'bambu' })))).toBe(true);
  });

  it('takes a sliced project from any slicer', () => {
    for (const slicer of ['bambu', 'orca', 'prusa', 'creality', 'anycubic']) {
      expect(fileTakesPrintProfile(file('p.3mf', scanned({ slicer, sliced: true })))).toBe(true);
    }
  });

  it('leaves an unsliced 3MF from anywhere else as ordinary geometry', () => {
    expect(fileTakesPrintProfile(file('part.3mf', scanned({ slicer: 'anycubic' })))).toBe(false);
    expect(fileTakesPrintProfile(file('cad.3mf', scanned()))).toBe(false);
  });

  it('is not fooled by the extension alone', () => {
    expect(fileTakesPrintProfile(file('mesh.stl', scanned({ slicer: 'bambu' })))).toBe(false);
    expect(fileTakesPrintProfile(file('unread.3mf', null))).toBe(false);
    expect(fileTakesPrintProfile(null)).toBe(false);
  });

  it('keeps what it has while the archive is still being read', () => {
    // Dropping the record mid-scan would wipe a name and photos already typed.
    expect(fileKeepsPrintProfile(file('scanning.3mf', undefined))).toBe(true);
    expect(fileKeepsPrintProfile(file('scanning.3mf', { scanned: false }))).toBe(true);
    expect(fileKeepsPrintProfile(file('done.3mf', scanned({ slicer: 'anycubic' })))).toBe(false);
    expect(fileKeepsPrintProfile(undefined)).toBe(false);
  });
});
