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
import { CONNECTABLE, getAccounts, rehydrateDesktopAccount, removeAccount, setStatus } from './lib/accounts.js';

beforeEach(() => {
  cleanup();
  for (const platform of CONNECTABLE) {
    for (const account of getAccounts(platform)) removeAccount(platform, account.id);
  }
  localStorage.clear();
  delete window.modelprepDesktop;
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
    expect(screen.getByText('Printables')).toBeInTheDocument();
    expect(screen.getByText('Cults3D')).toBeInTheDocument();
    expect(screen.getByText('Nexprint')).toBeInTheDocument();
    expect(screen.getByText('Creality Cloud')).toBeInTheDocument();
    expect(screen.getByText('MakerOnline')).toBeInTheDocument();
  });

  it('makes the MakerWorld window primary on desktop and keeps password login advanced', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      connectMakerWorld: vi.fn(),
      requestMakerWorld: vi.fn(),
      storeMakerWorldSession: vi.fn(),
      disconnectMakerWorld: vi.fn(),
      connectPrintables: vi.fn(),
      requestPrintables: vi.fn(),
      disconnectPrintables: vi.fn(),
      connectCults: vi.fn(),
      requestCults: vi.fn(),
      disconnectCults: vi.fn(),
      connectNexprint: vi.fn(),
      requestNexprint: vi.fn(),
      disconnectNexprint: vi.fn(),
      connectCreality: vi.fn(),
      requestCreality: vi.fn(),
      disconnectCreality: vi.fn(),
      connectMakerOnline: vi.fn(),
      requestMakerOnline: vi.fn(),
      disconnectMakerOnline: vi.fn(),
    };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByRole('button', { name: /sign in via makerworld window/i })).toBeInTheDocument();
    const fallback = screen.getByText(/advanced fallback: email \+ password/i).closest('details');
    expect(fallback).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: /sign in via printables window/i })).toBeEnabled();
    expect(screen.getByText(/real Printables\/Prusa OAuth page opens/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in via nexprint window/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /sign in via creality cloud window/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /sign in via makeronline window/i })).toBeEnabled();
  });

  it('explains when the web UI is newer than the running desktop bridge', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      bridgeVersion: 1,
      connectMakerWorld: vi.fn(),
      connectPrintables: vi.fn(),
      connectCults: vi.fn(),
      connectNexprint: vi.fn(),
      connectCreality: vi.fn(),
    };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/desktop app update required/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/MakerOnline/);
    expect(screen.getByRole('button', { name: /update modelprep desktop to connect makeronline/i })).toBeDisabled();
    expect(screen.getByText(/running desktop shell is older than this page/i)).toBeInTheDocument();
  });

  it('stores only the opaque Nexprint desktop marker after account validation', async () => {
    const connectNexprint = vi.fn().mockResolvedValue({
      ok: true,
      user: { id: 'U-test', nickname: 'Test creator' },
    });
    const requestNexprint = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, user: { id: 'U-test', nickname: 'Test creator' } }),
    });
    window.modelprepDesktop = { isDesktop: true, connectNexprint, requestNexprint };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /sign in via nexprint window/i }));

    expect(connectNexprint).toHaveBeenCalledOnce();
    expect(requestNexprint).toHaveBeenCalledOnce();
    const serialized = localStorage.getItem('modelprep:accounts');
    expect(serialized).toContain('desktop-managed-nexprint-session-v1');
    expect(serialized).not.toContain('auth_token');
  });

  it('stores only the opaque Creality desktop marker after account validation', async () => {
    const connectCreality = vi.fn().mockResolvedValue({
      ok: true,
      user: { id: '8155669516', nickname: 'Creality creator' },
    });
    const requestCreality = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, user: { id: '8155669516', nickname: 'Creality creator' } }),
    });
    window.modelprepDesktop = { isDesktop: true, connectCreality, requestCreality };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /sign in via creality cloud window/i }));

    expect(connectCreality).toHaveBeenCalledOnce();
    expect(requestCreality).toHaveBeenCalledOnce();
    const serialized = localStorage.getItem('modelprep:accounts');
    expect(serialized).toContain('desktop-managed-creality-session-v1');
    expect(serialized).not.toContain('model_token');
  });

  it('stores only the opaque MakerOnline desktop marker after account validation', async () => {
    const connectMakerOnline = vi.fn().mockResolvedValue({
      ok: true,
      user: { id: 'MO-test', nickname: 'MakerOnline creator' },
    });
    const requestMakerOnline = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, user: { id: 'MO-test', nickname: 'MakerOnline creator' } }),
    });
    window.modelprepDesktop = { isDesktop: true, connectMakerOnline, requestMakerOnline };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /sign in via makeronline window/i }));

    expect(connectMakerOnline).toHaveBeenCalledOnce();
    expect(requestMakerOnline).toHaveBeenCalledOnce();
    const serialized = localStorage.getItem('modelprep:accounts');
    expect(serialized).toContain('desktop-managed-makeronline-session-v1');
    expect(serialized).not.toContain('mo_access_token');
  });

  it('rehydrates encrypted desktop sessions without exposing credentials', async () => {
    const discoverAccounts = vi.fn().mockResolvedValue({
      ok: true,
      accounts: [
        { platform: 'makerworld', label: 'MakerWorld' },
        { platform: 'printables', label: 'Creator (@creator)' },
        { platform: 'cults', accountId: 'encrypted-account-456', label: 'creator@example.com' },
        { platform: 'nexprint', label: 'Creator' },
        { platform: 'creality', label: 'Creality creator' },
        { platform: 'makeronline', label: 'MakerOnline creator' },
      ],
    });
    window.modelprepDesktop = { isDesktop: true, discoverAccounts };

    render(<App />);
    expect(discoverAccounts).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      const serialized = localStorage.getItem('modelprep:accounts') || '';
      expect(serialized).toContain('desktop-managed-session-v1');
      expect(serialized).toContain('desktop-managed-printables-session-v1');
      expect(serialized).toContain('desktop-managed-cults-credentials-v1:encrypted-account-456');
      expect(serialized).toContain('desktop-managed-nexprint-session-v1');
      expect(serialized).toContain('desktop-managed-creality-session-v1');
      expect(serialized).toContain('desktop-managed-makeronline-session-v1');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('auth_token');
    });
  });

  it('marks an expired encrypted desktop session for reconnect', async () => {
    rehydrateDesktopAccount('printables', {
      label: 'Old Printables session',
      secret: 'desktop-managed-printables-session-v1',
    });
    window.modelprepDesktop = {
      isDesktop: true,
      discoverAccounts: vi.fn().mockResolvedValue({ ok: true, accounts: [] }),
    };

    const user = userEvent.setup();
    render(<App />);
    await vi.waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('modelprep:accounts') || '{}');
      expect(saved.printables?.accounts?.[0]?.status).toBe('reconnect');
    });
    await user.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByText('Reconnect needed')).toBeInTheDocument();
  });

  it('silently recovers an encrypted session before asking the user to sign in', async () => {
    const account = rehydrateDesktopAccount('printables', {
      label: 'Old Printables session',
      secret: 'desktop-managed-printables-session-v1',
    });
    setStatus('printables', account.id, 'reconnect');
    const recoverAccount = vi.fn().mockResolvedValue({
      ok: true,
      recovered: true,
      user: { handle: 'creator', publicUsername: 'Creator' },
    });
    window.modelprepDesktop = {
      isDesktop: true,
      discoverAccounts: vi.fn().mockResolvedValue({ ok: true, accounts: [] }),
      recoverAccount,
    };

    render(<App />);
    await vi.waitFor(() => expect(recoverAccount).toHaveBeenCalledWith('printables', ''));
    await vi.waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('modelprep:accounts') || '{}');
      expect(saved.printables?.accounts?.[0]?.status).toBe('connected');
      expect(saved.printables?.accounts?.[0]?.label).toBe('Creator (@creator)');
    });
  });

  it('offers one-click reconnect and opens interactive sign-in only after silent recovery fails', async () => {
    const account = rehydrateDesktopAccount('printables', {
      label: 'Creator (@creator)',
      secret: 'desktop-managed-printables-session-v1',
    });
    setStatus('printables', account.id, 'reconnect');
    const recoverAccount = vi.fn().mockResolvedValue({ ok: false, needsInteractive: true });
    const connectPrintables = vi.fn().mockResolvedValue({
      ok: true,
      user: { handle: 'creator', publicUsername: 'Creator' },
    });
    window.modelprepDesktop = { isDesktop: true, recoverAccount, connectPrintables };
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /^reconnect$/i }));

    expect(recoverAccount).toHaveBeenCalledWith('printables', '');
    expect(connectPrintables).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/connected and ready/i);
  });

  it('offers recovery from the Platforms card without leaving the workflow', async () => {
    const account = rehydrateDesktopAccount('printables', {
      label: 'Creator (@creator)',
      secret: 'desktop-managed-printables-session-v1',
    });
    setStatus('printables', account.id, 'reconnect');
    window.modelprepDesktop = { isDesktop: true };
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole('button', { name: /step 5: platforms/i }));
    await user.click(screen.getByRole('button', { name: /reconnect printables/i }));

    expect(screen.getAllByText('Settings').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: /^reconnect$/i })).toBeInTheDocument();
  });

  it('stores only an opaque Cults account id after desktop credential validation', async () => {
    const connectCults = vi.fn().mockResolvedValue({
      ok: true,
      accountId: 'encrypted-account-123',
      email: 'creator@example.com',
    });
    window.modelprepDesktop = { isDesktop: true, connectCults };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    const cultsEmail = screen.getByPlaceholderText('Cults3D email');
    const cultsForm = cultsEmail.closest('.space-y-1\\.5');
    await user.type(cultsEmail, 'creator@example.com');
    await user.type(within(cultsForm).getByPlaceholderText('Password'), 'super-secret-password');
    await user.click(within(cultsForm).getByRole('button', { name: /sign in to cults3d/i }));

    expect(connectCults).toHaveBeenCalledWith({
      email: 'creator@example.com',
      password: 'super-secret-password',
    });
    const serialized = localStorage.getItem('modelprep:accounts');
    expect(serialized).toContain('desktop-managed-cults-credentials-v1:encrypted-account-123');
    expect(serialized).not.toContain('super-secret-password');
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
