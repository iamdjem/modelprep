// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { deriveProjectReadiness, platformPreflight, pruneDestinationFileState, publishBlockers } from './App.jsx';
import { destinationReadinessSummary } from './lib/platform-workflow.js';

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
    const pending = readiness.destinations.reports.flatMap((report) => report.confirmations || []);
    expect(pending.map((item) => item.id)).toContain('makeroad-real-photo');
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

describe('three-tier severity', () => {
  const project = (patch = {}) => ({
    files: [{ id: 'f1', name: 'part.stl', size: 1, isModel: true }],
    media: [],
    images: Array.from({ length: 30 }, (_, i) => ({ id: `img${i}` })),
    coverImageId: 'img0',
    title: 'Calibration puck',
    description: '',
    category: '',
    tags: [],
    profiles: [],
    platforms: { makeronline: { enabled: true } },
    ...patch,
  });
  const makerOnline = { id: 'makeronline', name: 'MakerOnline', formats: ['stl'], limits: {}, maxImages: 20 };

  it('files an automatic change under adaptations, not warnings-as-alarms', () => {
    const result = platformPreflight(makerOnline, project());
    expect(result.adaptations.join(' ')).toMatch(/only the first 20 ordered model images/i);
    expect(result.optional.join(' ')).not.toMatch(/only the first 20/i);
  });

  it('files an unfilled optional field under optional, out of every count', () => {
    const result = platformPreflight(makerOnline, project());
    expect(result.optional).toContain('Description is empty.');
    expect(result.adaptations).not.toContain('Description is empty.');
    // warnings stays the union so adapters and receipts keep working.
    expect(result.warnings).toEqual([...result.adaptations, ...result.optional]);
  });

  it('never calls a destination amber for something ModelPrep does itself', () => {
    const summary = destinationReadinessSummary('makeronline', {
      errors: [],
      adaptations: ['MakerOnline uploads only the first 20 ordered model images.'],
      optional: ['Description is empty.'],
      confirmations: [],
    }, project());
    expect(summary.status).toBe('ready');
    expect(summary.label).toBe('Ready');
    expect(summary.adaptationCount).toBe(1);
    expect(summary.firstIssue).toBe('');
  });

  it('holds the upload until a self-attestation is ticked, without a standing error', () => {
    const unconfirmed = {
      files: [{ id: 'f1', name: 'part.stl', size: 1, isModel: true }], media: [],
      images: [{ id: 'cover' }], coverImageId: 'cover', title: 'Puck', description: 'A puck',
      category: 'tools', tags: ['puck'], profiles: [],
      platforms: { mmf: { enabled: true, categoryPath: 'toys', license: 'cc-by', confirmOriginalNoAi: false } },
    };
    const mmf = { id: 'mmf', name: 'MyMiniFactory', formats: ['stl'], limits: {} };
    const before = platformPreflight(mmf, unconfirmed);
    expect(before.errors.join(' ')).not.toMatch(/generative AI/i);
    expect(publishBlockers(before).join(' ')).toMatch(/generative AI/i);

    const after = platformPreflight(mmf, {
      ...unconfirmed,
      platforms: { mmf: { ...unconfirmed.platforms.mmf, confirmOriginalNoAi: true } },
    });
    expect(after.confirmations).toEqual([]);
    expect(publishBlockers(after).join(' ')).not.toMatch(/generative AI/i);
  });
});

describe('empty projects', () => {
  it('says one thing instead of ten platforms worth of alarms', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 6: publish/i }));
    expect(screen.getByText('Add files to get started.')).toBeInTheDocument();
    expect(screen.queryByText(/blocker/i)).toBeNull();
    expect(screen.queryByText(/Destination readiness/i)).toBeNull();
  });
});

describe('shared listing summary', () => {
  it('derives the Thingiverse summary from the description, like Printables', () => {
    const project = {
      files: [{ id: 'f1', name: 'part.stl', size: 1, isModel: true }], media: [],
      images: [{ id: 'cover' }], coverImageId: 'cover',
      title: 'Calibration puck',
      description: '# Calibration puck\n\nA support-free puck for testing upload mappings.',
      category: 'tools', tags: ['puck'], profiles: [],
      platforms: { thingiverse: { enabled: true, summary: '', categoryId: '71', license: 'cc', termsAccepted: true } },
    };
    const thingiverse = { id: 'thingiverse', name: 'Thingiverse', formats: ['stl'], limits: {} };
    expect(platformPreflight(thingiverse, project).errors.join(' ')).not.toMatch(/summary/i);

    const empty = { ...project, description: '' };
    expect(platformPreflight(thingiverse, empty).errors.join(' ')).toMatch(/Add a description in Details/i);
  });
});

describe('shared disclosures in Details', () => {
  it('asks the origin, AI and NSFW questions once', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));

    expect(screen.getByRole('radio', { name: /my own original model/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /made with generative ai/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /mature content/i })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /a remix of someone else/i }));
    expect(screen.getByLabelText(/original model url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what did you change/i)).toBeInTheDocument();
  });
});
