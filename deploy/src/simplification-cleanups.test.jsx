// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { deriveProjectReadiness, pruneDestinationFileState } from './App.jsx';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  delete window.modelprepDesktop;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    set fillStyle(_value) {},
    set font(_value) {},
    set textAlign(_value) {},
    set textBaseline(_value) {},
  }));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,ZGVtbw==');
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline cleanup test'))));
});

describe('readiness phase classification', () => {
  // The old classifier matched the bare word "profile" anywhere in an error, so
  // MakerRoad's "Confirm a real print photo in Profiles" was counted as a
  // Package blocker and the Files step showed a problem it could not fix.
  it('keeps a destination attestation out of the package phase', () => {
    const project = {
      files: [{ id: 'f1', name: 'part.stl', size: 1, isModel: true }],
      media: [],
      images: [{ id: 'cover' }, { id: 'side' }, { id: 'detail' }],
      coverImageId: 'cover',
      title: 'Calibration puck',
      description: 'A printable puck',
      category: 'tools',
      tags: ['puck'],
      profiles: [{ id: 'profile', realPhotoConfirmed: false }],
      platforms: {
        makeroad: { enabled: true, categoryIds: ['test-models'], printMethods: ['fdm'], visibility: 'private', payType: 'free' },
      },
    };
    const readiness = deriveProjectReadiness(project);
    const blocked = readiness.destinations.reports.flatMap((report) => report.errors).join(' ');
    expect(blocked).toMatch(/MakerRoad review requires a confirmed real photo/i);
    expect(readiness.package.profileBlockers).toEqual([]);
  });

  it('still reports a missing model file as a package blocker', () => {
    const readiness = deriveProjectReadiness({
      files: [], media: [], images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Puck', description: '', category: '', tags: [], profiles: [],
      platforms: { thangs: { enabled: true } },
    });
    expect(readiness.package.profileBlockers.join(' ')).toMatch(/No model file to upload/i);
  });
});

describe('removing files clears their destination routing', () => {
  it('drops roles, exclusions and primary picks for the removed file', () => {
    const platforms = {
      thangs: {
        fileRoles: { f1: 'model', f2: 'reference' },
        excludedFileIds: ['f1', 'f2'],
        primaryFileId: 'f1',
        primaryProfileFileId: 'f1',
      },
    };
    const next = pruneDestinationFileState(platforms, new Set(['f1']));
    expect(next.thangs.fileRoles).toEqual({ f2: 'reference' });
    expect(next.thangs.excludedFileIds).toEqual(['f2']);
    expect(next.thangs.primaryFileId).toBe('');
    expect(next.thangs.primaryProfileFileId).toBe('');
  });
});

describe('Details step gate', () => {
  // Preflight treats description, category and tags as warnings, so the step
  // gate must not treat them as blockers.
  it('continues on a title alone', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));
    expect(screen.getByRole('button', { name: /continue to images/i })).toBeEnabled();
  });
});
