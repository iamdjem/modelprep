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
    // Try demo lives in the project-name menu now.
    await user.click(screen.getByRole('button', { name: /project menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /try demo/i }));
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
    // Try demo lives in the project-name menu now.
    await user.click(screen.getByRole('button', { name: /project menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));

    expect(screen.getByRole('radio', { name: /my own original model/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /made with generative ai/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /mature content/i })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /a remix of someone else/i }));
    expect(screen.getByLabelText(/original model url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what did you change/i)).toBeInTheDocument();
  });
});

describe('top bar', () => {
  it('keeps four controls and puts project identity in one menu', async () => {
    const user = userEvent.setup();
    render(<App />);

    const actions = screen.getByTestId('top-header-actions');
    expect(actions.querySelectorAll('button')).toHaveLength(2); // Settings, Review and publish
    expect(screen.queryByRole('button', { name: /^templates$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^new$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^import$/i })).toBeNull();
    expect(screen.getByText(/0 of 5 steps done/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review and publish/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /project menu/i }));
    for (const item of [/rename project/i, /new project/i, /try demo/i]) {
      expect(screen.getByRole('menuitem', { name: item })).toBeInTheDocument();
    }
  });

  it('offers the folder import on the Files screen, next to Add files', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /import a folder/i })).toBeInTheDocument();
  });
});

describe('Details layout', () => {
  it('picks a license without moving anything else on the page', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /project menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));

    // One select, grouped by the question creators decide first. The old card
    // opened an inline chooser whose height changed with every filter click.
    const license = screen.getByLabelText('License');
    expect(license.tagName).toBe('SELECT');
    expect([...license.querySelectorAll('optgroup')].map((group) => group.label))
      .toEqual(['Commercial use allowed', 'Non-commercial only']);
    expect(screen.queryByRole('button', { name: /^change$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /commercial ok/i })).toBeNull();

    await user.selectOptions(license, 'cc0');
    expect(license).toHaveValue('cc0');
    expect(screen.getByText(/Commercial use allowed · Remixes allowed/)).toBeInTheDocument();
  });

  // Every field opens with the same header row, which is what puts the left
  // column's controls on the same lines as the right column's. A label with its
  // own margin used to sit the Category select 8px above the Title input.
  it('gives both columns the same field header, so their controls line up', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));

    for (const field of ['Title', 'Description (markdown)', 'Category', 'License', 'Tags', 'Origin and disclosures']) {
      const header = screen.getByText(field, { selector: 'label' }).parentElement;
      expect(header).toHaveClass('flex', 'items-center', 'min-h-[28px]', 'mb-2');
    }
    // The category hint restated the page subtitle and knocked the rail out of
    // step with the left column by its own two lines.
    expect(screen.queryByText(/Each platform has its own category tree/i)).toBeNull();
  });
});

describe('the listing writer', () => {
  it('offers one button, in the header when collapsed and by the hint when open', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));

    // Collapsed: one button, and pressing it does not open the panel.
    expect(screen.getAllByRole('button', { name: /write it/i })).toHaveLength(1);
    expect(screen.queryByPlaceholderText(/anything the photos do not show/i)).toBeNull();

    await user.click(screen.getByText(/write the listing for me/i));
    expect(screen.getByPlaceholderText(/anything the photos do not show/i)).toBeInTheDocument();
    // Open: still one, next to the hint field rather than doubled up.
    expect(screen.getAllByRole('button', { name: /write it/i })).toHaveLength(1);
  });
});

describe('copy', () => {
  it('uses straight quotes and names screens rather than step numbers', () => {
    render(<App />);
    const text = document.body.textContent;
    expect(text).not.toMatch(/[‘’“”]/);
    expect(text).not.toMatch(/step 0\d/i);
  });
});

describe('Settings panel', () => {
  it('keeps one size on every tab and hands the screen back on Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));

    const panel = screen.getByRole('dialog', { name: 'Settings' });
    // Full viewport height, so switching tabs cannot resize or re-centre it.
    // The old dialog was sized to its content: About is a build stamp, Accounts
    // is ten sign-in cards, and the tab strip moved between them.
    expect(panel).toHaveClass('h-full', 'flex', 'flex-col');
    const body = panel.lastElementChild;
    expect(body).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto');

    for (const tabName of ['About', 'Defaults', 'Help', 'Accounts']) {
      await user.click(screen.getByRole('button', { name: tabName }));
      expect(screen.getByRole('dialog', { name: 'Settings' })).toHaveClass('h-full');
    }

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('connecting one platform', () => {
  it('opens that platform alone, not the top of a list of ten', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /project menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /try demo/i }));
    await user.click(screen.getByRole('button', { name: /step 6: publish/i }));

    await user.click(await screen.findByRole('button', { name: /connect printables/i }));
    const panel = screen.getByRole('dialog', { name: 'Connect Printables' });
    // One sign-in, no tab strip, and nothing to scroll past.
    expect(panel).toHaveTextContent(/Sign in to Printables/i);
    expect(panel).not.toHaveTextContent(/MakerWorld/);
    expect(panel).not.toHaveTextContent(/Cults3D/);
    expect(screen.queryByRole('button', { name: 'Defaults' })).toBeNull();

    // The way out to everything else.
    await user.click(screen.getByRole('button', { name: /all accounts and settings/i }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Defaults' })).toBeInTheDocument();
  });
});
