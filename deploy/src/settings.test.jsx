// @vitest-environment jsdom
//
// Smoke test for the unified Settings page after consolidating Accounts + AI config.
// Verifies: the header opens Settings, all tabs render, the moved AI config lives in
// Settings AND persists to localStorage (remembered across runs), and the Details
// "Set up AI" shortcut deep-links into the AI tab.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  // VersionBanner + connect checks poll the network; stub it so they no-op in jsdom.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no network in test'))));
});

describe('Unified Settings page', () => {
  it('opens from the header and shows Accounts, AI and About tabs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));

    // Modal heading + all three tabs present.
    const dialogTabs = ['Accounts', 'AI', 'About'];
    for (const t of dialogTabs) expect(screen.getByRole('button', { name: new RegExp(`^${t}`, 'i') })).toBeInTheDocument();

    // Accounts tab (default) shows the connectable platforms.
    expect(screen.getByText('MakerWorld')).toBeInTheDocument();
    expect(screen.getByText('Cults3D')).toBeInTheDocument();
  });

  it('moves the AI config into Settings and persists it across runs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /^AI/i }));

    // Provider picker is here now (not on the Details page).
    const provider = screen.getByRole('combobox');
    await user.selectOptions(provider, 'openrouter');

    // Key + model fields appear and write through to localStorage.
    const key = await screen.findByPlaceholderText(/sk-/i);
    await user.type(key, 'test-key-123');

    const saved = JSON.parse(localStorage.getItem('modelprep:ai-config'));
    expect(saved.provider).toBe('openrouter');
    expect(saved.apiKey).toBe('test-key-123');
    // Default model preset applied for the provider.
    expect(saved.model).toContain('llama');
  });

  it('About tab shows the build label', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /^About/i }));
    expect(screen.getAllByText(/build/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /clear saved accounts/i })).toBeInTheDocument();
  });

  it('Defaults tab persists the default platform selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /^Defaults/i }));

    // Toggling a platform off writes the new default set to localStorage.
    const dialog = screen.getByText(/which platforms a new project starts/i).closest('div');
    const mwBtn = within(dialog.parentElement).getByRole('button', { name: /makerworld/i });
    await user.click(mwBtn); // turn MakerWorld off

    const saved = JSON.parse(localStorage.getItem('modelprep:default-platforms'));
    expect(Array.isArray(saved)).toBe(true);
    expect(saved).not.toContain('makerworld');
  });

  it('Details "Set up AI" deep-links into the Settings AI tab', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Navigate to the Details step via the sidebar (first matching nav button).
    await user.click(screen.getAllByRole('button', { name: /details/i })[0]);
    // The AI shortcut on Details opens Settings on the AI tab.
    await user.click(screen.getByRole('button', { name: /set up ai/i }));
    // AI tab content (the provider hint about keys) is now visible.
    expect(screen.getByText(/stored only in this browser/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
