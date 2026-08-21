// @vitest-environment jsdom
// A picture one platform cannot take must not stop that platform, because the
// gallery is shared: the only remedy used to be shrinking the picture for
// everybody. See lib/platform-images.js.
import { describe, expect, it } from 'vitest';
import { PLATFORMS, platformPreflight } from './App.jsx';

const MB = 1024 * 1024;
const mmf = PLATFORMS.find((platform) => platform.id === 'mmf');

const picture = (id, size) => ({ id, name: `${id}.jpg`, dataUrl: 'data:image/jpeg;base64,AA', size });

const projectWith = (images, platformOpts = {}) => ({
  title: 'Ram', description: 'A ram', tags: ['ram'],
  images, coverImageId: images[0]?.id,
  files: [{ id: 'f1', name: 'ram.stl', isModel: true, size: 2 * MB }],
  profiles: [],
  platforms: { mmf: { enabled: true, publication: 'private', categoryIds: [60, 462], licenseId: 5, ...platformOpts } },
});

const errorsFor = (project) => platformPreflight(mmf, project).errors;
const adaptationsFor = (project) => platformPreflight(mmf, project).adaptations || [];

describe('a picture MyMiniFactory cannot take', () => {
  it('is skipped and reported, not turned into a blocker', () => {
    const project = projectWith([picture('hero', 6 * MB), picture('shot', 40 * 1024)]);
    expect(errorsFor(project).filter((error) => /5 MB|picture/i.test(error))).toEqual([]);
    expect(adaptationsFor(project).some((note) => /1 picture skipped for MyMiniFactory/.test(note))).toBe(true);
  });

  it('hands the lead to the next picture that fits', () => {
    const project = projectWith([picture('hero', 6 * MB), picture('shot', 40 * 1024)]);
    expect(adaptationsFor(project).some((note) => /shot\.jpg leads instead/.test(note))).toBe(true);
  });

  it('still blocks when nothing at all can go', () => {
    const project = projectWith([picture('hero', 6 * MB)]);
    expect(errorsFor(project).some((error) => /^No picture here can go to MyMiniFactory/.test(error))).toBe(true);
  });

  it('says nothing when every picture fits', () => {
    const project = projectWith([picture('a', 1 * MB), picture('b', 2 * MB)]);
    expect(adaptationsFor(project).some((note) => /picture/i.test(note))).toBe(false);
  });

  it('lets a per-platform cover override the automatic choice', () => {
    const project = projectWith([picture('a', 1 * MB), picture('b', 2 * MB)], { coverImageId: 'b' });
    expect(errorsFor(project).filter((error) => /picture/i.test(error))).toEqual([]);
  });
});
