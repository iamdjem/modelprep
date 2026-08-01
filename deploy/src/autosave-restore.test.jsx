// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

const AUTOSAVE_KEY = 'modelprep:autosave:v1';
const HANDLED_KEY = 'modelprep:autosave:handled:v1';

function savedProject(overrides = {}) {
  return {
    name: 'Test 1',
    title: 'Test 1',
    description: 'A recoverable description',
    tags: ['test'],
    category: 'Other',
    license: 'ccbync',
    platforms: {},
    savedAt: 123,
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  delete window.modelprepDesktop;
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

describe('autosave restore prompt', () => {
  it('offers one saved snapshot only once after Cancel', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    const user = userEvent.setup();
    const first = render(<App />);

    expect(screen.getByRole('heading', { name: /restore text & settings/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(localStorage.getItem(HANDLED_KEY)).toBeTruthy();

    first.unmount();
    render(<App />);
    expect(screen.queryByRole('heading', { name: /restore text & settings/i })).not.toBeInTheDocument();
  });

  it('does not re-offer restored content when only savedAt changes', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    const user = userEvent.setup();
    const first = render(<App />);

    await user.click(screen.getByRole('button', { name: /restore text & settings/i }));
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject({ savedAt: 999 })));

    first.unmount();
    render(<App />);
    expect(screen.queryByRole('heading', { name: /restore text & settings/i })).not.toBeInTheDocument();
  });

  it('does not re-offer a restored snapshot after platform defaults are merged and autosaved', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject({
      platforms: { makerworld: { enabled: true } },
    })));
    const user = userEvent.setup();
    const first = render(<App />);

    await user.click(screen.getByRole('button', { name: /restore text & settings/i }));
    await waitFor(() => {
      const autosave = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || 'null');
      expect(Object.keys(autosave?.platforms || {})).toContain('makeronline');
    }, { timeout: 1500 });

    first.unmount();
    render(<App />);
    expect(screen.queryByRole('heading', { name: /restore text & settings/i })).not.toBeInTheDocument();
  });

  it('migrates a handled v1 fingerprint without resurrecting the prompt', () => {
    const saved = savedProject({ platforms: { makerworld: { enabled: true } } });
    const legacyFingerprint = JSON.stringify({
      name: saved.name,
      title: saved.title,
      description: saved.description,
      tags: saved.tags,
      category: saved.category,
      license: saved.license,
      platforms: saved.platforms,
    });
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(saved));
    localStorage.setItem(HANDLED_KEY, legacyFingerprint);

    render(<App />);
    expect(screen.queryByRole('heading', { name: /restore text & settings/i })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HANDLED_KEY))).toMatchObject({ version: 2 });
  });

  it('offers recovery again after the saved content changes', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    first.unmount();

    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify(savedProject({ title: 'A genuinely newer draft', savedAt: 456 }))
    );
    render(<App />);
    expect(screen.getByRole('heading', { name: /restore text & settings/i })).toBeInTheDocument();
  });
});
