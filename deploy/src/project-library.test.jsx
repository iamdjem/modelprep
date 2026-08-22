// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App, { releasePlanStore } from './App.jsx';
import {
  CURRENT_PROJECT_KEY, LEGACY_AUTOSAVE_KEY, LIBRARY_KEY, formatProjectDate, loadLibrary,
} from './lib/project-library.js';

const PLANS_KEY = 'modelprep:release-plans:v1';

function entry(overrides = {}) {
  const title = overrides.title || 'Test 1';
  return {
    id: overrides.id || 'proj-1',
    name: overrides.name || title,
    nameLocked: false,
    title,
    createdAt: 100,
    updatedAt: overrides.updatedAt || 100,
    meta: { title, description: 'A recoverable description', tags: ['test'], category: 'Other', license: 'ccbync', platforms: {} },
    summary: { files: 0, images: 0, stepsDone: 1, stepCount: 5 },
    ...overrides,
  };
}

function seed(entries, currentId = entries[0]?.id) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
  if (currentId) localStorage.setItem(CURRENT_PROJECT_KEY, currentId);
}

function duePlan(overrides = {}) {
  return [{
    id: 'plan-1',
    projectId: 'proj-1',
    projectTitle: 'Test 1',
    platformId: 'printables',
    platformName: 'Printables',
    mode: 'scheduled',
    dueAt: new Date(Date.now() - 60_000).toISOString(),
    note: '',
    unattended: true,
    createdAt: 1,
    status: 'pending',
    ...overrides,
  }];
}

const projectMenu = () => screen.getByRole('button', { name: /project menu/i });
const publishStep = () => screen.getByRole('button', { name: /step 5: publish/i });

beforeEach(() => {
  cleanup();
  localStorage.clear();
  releasePlanStore.set([]);
  delete window.modelprepDesktop;
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

describe('reopening on launch', () => {
  it('reopens the project that was open last time, without asking', async () => {
    seed([entry()]);
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('folds the old single autosave slot into the library once', async () => {
    localStorage.setItem(LEGACY_AUTOSAVE_KEY, JSON.stringify({ name: 'Untitled Project', title: 'Night Release', description: 'd', tags: ['x'], platforms: {}, savedAt: 5 }));
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Night Release'));
    expect(localStorage.getItem(LEGACY_AUTOSAVE_KEY)).toBeNull();
    expect(loadLibrary(localStorage).map((item) => item.title)).toEqual(['Night Release']);
  });

  it('starts a dated, empty project when nothing was saved', () => {
    render(<App />);
    expect(projectMenu()).toHaveTextContent(`Project ${formatProjectDate(Date.now())}`);
    expect(loadLibrary(localStorage)).toEqual([]);
  });
});

describe('the library', () => {
  it('keeps the previous project when a new one starts, and switches back from the menu', async () => {
    seed([entry()]);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));

    await user.click(screen.getByRole('button', { name: /new project/i }));
    expect(projectMenu()).toHaveTextContent(`Project ${formatProjectDate(Date.now())}`);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // nothing to confirm: nothing is discarded

    await user.click(projectMenu());
    await user.click(screen.getByRole('menuitem', { name: /Test 1/ }));
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));
  });

  it('saves the open project into the library as soon as it has content', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 2: details/i }));
    await user.type(screen.getByPlaceholderText(/articulating desk dragon/i), 'Bracket');
    await waitFor(() => expect(loadLibrary(localStorage).map((item) => item.title)).toEqual(['Bracket']), { timeout: 3000 });
    expect(projectMenu()).toHaveTextContent('Bracket');
  });

  it('lists, duplicates and deletes from the projects panel', async () => {
    seed([entry(), entry({ id: 'proj-2', title: 'Second', updatedAt: 50 })]);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));

    await user.click(projectMenu());
    await user.click(screen.getByRole('menuitem', { name: /all projects/i }));
    const panel = screen.getByTestId('projects-panel');
    expect(within(panel).getAllByTestId('project-row')).toHaveLength(2);

    await user.click(within(panel).getByRole('button', { name: /delete second/i }));
    await user.click(screen.getByRole('button', { name: /delete project/i }));
    expect(within(screen.getByTestId('projects-panel')).getAllByTestId('project-row')).toHaveLength(1);
    expect(loadLibrary(localStorage).map((item) => item.id)).toEqual(['proj-1']);

    await user.click(within(screen.getByTestId('projects-panel')).getByRole('button', { name: /duplicate test 1/i }));
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Copy of Test 1'));
    await waitFor(() => expect(loadLibrary(localStorage).map((item) => item.name).sort()).toEqual(['Copy of Test 1', 'Test 1']), { timeout: 3000 });
  });

  it('renames from the menu and keeps the typed name over the title', async () => {
    seed([entry()]);
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));
    await user.click(projectMenu());
    await user.click(screen.getByRole('menuitem', { name: /rename project/i }));
    const input = screen.getByLabelText(/project name/i);
    await user.clear(input);
    await user.type(input, 'Client job{Enter}');
    expect(projectMenu()).toHaveTextContent('Client job');
  });
});

describe('scheduled publishes', () => {
  it('reopens the due project and lands on Publish by itself', async () => {
    seed([entry()]);
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan()));
    render(<App />);
    await waitFor(() => expect(publishStep()).toHaveAttribute('aria-current', 'step'));
  });

  it('asks before switching when the due project is not the open one', async () => {
    seed([entry(), entry({ id: 'proj-2', title: 'Second' })], 'proj-2');
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan()));
    releasePlanStore.set(duePlan());
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Second'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/"Test 1" is due on Printables/);
    await user.click(within(dialog).getByRole('button', { name: /open and publish/i }));
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));
    expect(publishStep()).toHaveAttribute('aria-current', 'step');
  });

  it('does not move for a reminder, which never publishes by itself', async () => {
    seed([entry()]);
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan({ mode: 'remind' })));
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));
    expect(publishStep()).not.toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not move before the plan is due', async () => {
    seed([entry()]);
    localStorage.setItem(PLANS_KEY, JSON.stringify(duePlan({ dueAt: new Date(Date.now() + 86_400_000).toISOString() })));
    render(<App />);
    await waitFor(() => expect(projectMenu()).toHaveTextContent('Test 1'));
    expect(publishStep()).not.toHaveAttribute('aria-current', 'step');
  });
});
