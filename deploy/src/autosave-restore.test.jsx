// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App, { releasePlanStore } from './App.jsx';

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
  releasePlanStore.set([]);
  delete window.modelprepDesktop;
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

describe('autosave restore prompt', () => {
  it('offers one saved snapshot only once after Dismiss', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    const user = userEvent.setup();
    const first = render(<App />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^dismiss$/i }));
    expect(localStorage.getItem(HANDLED_KEY)).toBeTruthy();

    first.unmount();
    render(<App />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not re-offer restored content when only savedAt changes', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    const user = userEvent.setup();
    const first = render(<App />);

    await user.click(screen.getByRole('button', { name: /restore text & settings/i }));
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject({ savedAt: 999 })));

    first.unmount();
    render(<App />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HANDLED_KEY))).toMatchObject({ version: 2 });
  });

  it('offers recovery again after the saved content changes', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(screen.getByRole('button', { name: /^dismiss$/i }));
    first.unmount();

    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify(savedProject({ title: 'A genuinely newer draft', savedAt: 456 }))
    );
    render(<App />);
    expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeInTheDocument();
  });
});

describe('scheduled publish after a restart', () => {
  const PLANS_KEY = 'modelprep:release-plans:v1';

  it('restores the project by itself and heads to Publish when a scheduled plan is due', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject({ title: 'Night Release' })));
    releasePlanStore.set([{
      id: 'plan-1', projectTitle: 'Night Release', platformId: 'makerworld', platformName: 'MakerWorld',
      mode: 'scheduled', dueAt: new Date(Date.now() - 3600_000).toISOString(), status: 'pending',
    }]);

    render(<App />);

    // No offer bar: waiting for a click would defeat the schedule.
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      // It navigated itself to the Publish step, where the queue auto-starts.
      expect(screen.getByRole('main', { name: /publish step/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('still just offers quietly when the due plan belongs to a different project', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject({ title: 'Something Else' })));
    releasePlanStore.set([{
      id: 'plan-2', projectTitle: 'Night Release', platformId: 'makerworld', platformName: 'MakerWorld',
      mode: 'scheduled', dueAt: new Date(Date.now() - 3600_000).toISOString(), status: 'pending',
    }]);

    render(<App />);
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('does not auto-restore for a mere reminder', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject({ title: 'Night Release' })));
    releasePlanStore.set([{
      id: 'plan-3', projectTitle: 'Night Release', platformId: 'makerworld', platformName: 'MakerWorld',
      mode: 'remind', dueAt: new Date(Date.now() - 3600_000).toISOString(), status: 'pending',
    }]);

    render(<App />);
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});

// The whole point of a scheduled release is that it runs without the user
// shepherding it. Before this, a plan that came due while the app was closed
// found an empty project on relaunch and sat in the queue going further overdue.
describe('scheduled release on relaunch', () => {
  const PLANS_KEY = 'modelprep:release-plans:v1';
  const duePlan = (over = {}) => ([{
    id: 'plan-1',
    projectTitle: 'Test 1',
    platformId: 'makerworld',
    platformName: 'MakerWorld',
    mode: 'scheduled',
    status: 'pending',
    dueAt: new Date(Date.now() - 3600_000).toISOString(),
    createdAt: 1,
    ...over,
  }]);

  it('restores itself and lands on Publish, without waiting for a click', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan()));

    render(<App />);

    // No offer bar: it restored rather than asking. (Dismiss is unique to it;
    // role=status is not, since the Publish step has its own live regions.)
    await waitFor(() => expect(screen.getByTestId('status-bar')).toHaveTextContent(/Step 6 of 6/i));
    expect(screen.queryByRole('button', { name: /^dismiss$/i })).not.toBeInTheDocument();
    expect(localStorage.getItem(HANDLED_KEY)).toBeTruthy();
  });

  it('leaves a plan for a different project alone', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan({ projectTitle: 'Someone else' })));

    render(<App />);
    // Falls through to the ordinary quiet offer.
    expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeInTheDocument();
  });

  it('does not self-restore for a reminder, which never publishes by itself', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan({ mode: 'remind' })));

    render(<App />);
    expect(screen.getByRole('button', { name: /^dismiss$/i })).toBeInTheDocument();
  });

  it('does not self-restore before the plan is due', async () => {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(savedProject()));
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan({ dueAt: new Date(Date.now() + 86_400_000).toISOString() })));

    render(<App />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
