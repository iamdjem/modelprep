// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { PLATFORMS } from './App.jsx';

const byId = (id) => PLATFORMS.find((platform) => platform.id === id);

describe('per-platform cover specs', () => {
  // Thangs' own editor states the requirement: at least 336x410 with a 1/1.22
  // aspect. ModelPrep passed originals straight through only because the
  // capture had recorded per-image dimensions as unknown.
  it('offers Thangs the documented 1:1.22 model-card crop', () => {
    const card = byId('thangs').covers.find((cover) => cover.id === 'card');
    expect(card).toBeTruthy();
    expect(card.w / card.h).toBeCloseTo(1 / 1.22, 3);
    expect(card.w).toBeGreaterThanOrEqual(336);
    expect(card.h).toBeGreaterThanOrEqual(410);
  });

  // The first cover drives gallery downloads, so the pass-through has to stay
  // first: adding a crop option must not start cropping the whole gallery.
  it('keeps the original as the primary Thangs cover', () => {
    const [first] = byId('thangs').covers;
    expect(first.id).toBe('cover');
    expect(first.w).toBeNull();
    expect(first.h).toBeNull();
  });

  // Cropping is decided per cover rather than per platform now. Platforms that
  // pass originals through declare null dimensions, and that is what keeps
  // them uncropped.
  it('every preserve-originals platform still leads with a null-dimension cover', () => {
    const preserving = PLATFORMS.filter((platform) => platform.preserveOriginalImages);
    expect(preserving.length).toBeGreaterThan(0);
    for (const platform of preserving) {
      const [first] = platform.covers;
      expect(first.w, `${platform.id} primary cover`).toBeNull();
      expect(first.h, `${platform.id} primary cover`).toBeNull();
    }
  });

  it('every sized cover declares both dimensions and an aspect label', () => {
    for (const platform of PLATFORMS) {
      for (const cover of platform.covers) {
        if (cover.w || cover.h) {
          expect(cover.w, `${platform.id}/${cover.id}`).toBeGreaterThan(0);
          expect(cover.h, `${platform.id}/${cover.id}`).toBeGreaterThan(0);
          expect(cover.aspect, `${platform.id}/${cover.id}`).toBeTruthy();
        }
      }
    }
  });
});
