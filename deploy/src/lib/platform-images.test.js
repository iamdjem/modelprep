import { describe, expect, it } from 'vitest';
import { imageRejection, platformImageNote, platformImagePlan } from './platform-images.js';

const MB = 1024 * 1024;
const mmf = { id: 'mmf', name: 'MyMiniFactory', maxImageMb: 5, stillImagesOnly: true };
const open = { id: 'cults', name: 'Cults3D' };

const picture = (id, extra = {}) => ({ id, name: `${id}.jpg`, dataUrl: 'data:image/jpeg;base64,AA', size: MB, ...extra });

describe('what each platform receives', () => {
  it('takes everything when the platform has no limits', () => {
    const project = { images: [picture('a'), picture('b')], coverImageId: 'b' };
    const plan = platformImagePlan(open, project);
    expect(plan.cover.id).toBe('b');
    expect(plan.gallery.map((image) => image.id)).toEqual(['a']);
    expect(plan.skipped).toEqual([]);
    expect(platformImageNote(open, project)).toBeNull();
  });

  it('skips an oversized picture instead of blocking the platform', () => {
    // The case that had no remedy: images are project-wide, so a 6 MB cover
    // could only be fixed by shrinking it for every platform.
    const project = { images: [picture('big', { size: 6 * MB }), picture('ok')], coverImageId: 'big' };
    const plan = platformImagePlan(mmf, project);
    expect(plan.cover.id).toBe('ok');
    expect(plan.coverSource).toBe('fallback');
    expect(plan.skipped).toEqual([{ id: 'big', name: 'big.jpg', reason: "over MyMiniFactory's 5 MB per-picture cap" }]);
    expect(platformImageNote(mmf, project)).toMatch(/1 picture skipped for MyMiniFactory/);
  });

  it('skips animation where the platform takes stills only', () => {
    const project = { images: [picture('clip', { type: 'image/gif' }), picture('still')], coverImageId: 'clip' };
    const plan = platformImagePlan(mmf, project);
    expect(plan.cover.id).toBe('still');
    expect(plan.skipped[0].reason).toBe('MyMiniFactory takes still pictures only');
  });

  it('honours an explicit per-platform cover', () => {
    const project = { images: [picture('a'), picture('b'), picture('c')], coverImageId: 'a' };
    const plan = platformImagePlan(mmf, project, { coverImageId: 'c' });
    expect(plan.cover.id).toBe('c');
    expect(plan.coverSource).toBe('chosen');
    expect(plan.gallery.map((image) => image.id)).toEqual(['a', 'b']);
  });

  it('ignores a per-platform cover the platform cannot take', () => {
    const project = { images: [picture('a'), picture('big', { size: 9 * MB })], coverImageId: 'a' };
    const plan = platformImagePlan(mmf, project, { coverImageId: 'big' });
    expect(plan.cover.id).toBe('a');
  });

  it('says so plainly when nothing can go', () => {
    const project = { images: [picture('big', { size: 9 * MB })], coverImageId: 'big' };
    const plan = platformImagePlan(mmf, project);
    expect(plan.cover).toBeNull();
    expect(platformImageNote(mmf, project)).toMatch(/^No picture here can go to MyMiniFactory/);
  });

  it('does not treat an unreadable picture as a platform rule', () => {
    // That is a project problem, and the platform's own preflight reports it.
    const project = { images: [{ id: 'a', name: 'a.jpg' }], coverImageId: 'a' };
    expect(platformImagePlan(mmf, project).cover?.id).toBe('a');
  });

  it('measures a data URL when no size was recorded', () => {
    const sixMb = 'data:image/jpeg;base64,' + 'A'.repeat(Math.ceil((6 * MB * 4) / 3));
    expect(imageRejection(mmf, { id: 'x', dataUrl: sixMb })).toMatch(/5 MB per-picture cap/);
  });
});
