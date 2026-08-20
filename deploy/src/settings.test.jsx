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

    expect(screen.getByRole('button', { name: /sign in to makerworld/i })).toBeInTheDocument();
    const fallback = screen.getByText(/advanced fallback: email \+ password/i).closest('details');
    expect(fallback).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: /sign in to printables/i })).toBeEnabled();
    expect(screen.getByText(/own Prusa sign-in page/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in to nexprint/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /sign in to creality cloud/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /sign in to makeronline/i })).toBeEnabled();
  });

  it('renders every platform connect form with the same shape', async () => {
    // Each platform's sign-in used to be hand-rolled, so they drifted: a narrow
    // button here, an unstyled Cancel there, the note above the field on Cults3D.
    window.modelprepDesktop = {
      isDesktop: true,
      connectMakerWorld: vi.fn(), connectPrintables: vi.fn(), connectCults: vi.fn(),
      connectNexprint: vi.fn(), connectCreality: vi.fn(), connectMakerOnline: vi.fn(),
      connectMyMiniFactory: vi.fn(), connectThangs: vi.fn(), connectThingiverse: vi.fn(),
      connectMakerRoad: vi.fn(),
    };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));

    const signIns = screen.getAllByRole('button', { name: /^sign in to /i });
    expect(signIns.length).toBe(10);
    for (const button of signIns) {
      // One full-width primary button per platform, same size class.
      expect(button).toHaveClass('mp-btn', 'w-full', 'text-sm', 'py-2', 'px-4');
      // The note sits after the button, never above the name field.
      const form = button.parentElement;
      const note = within(form).getByText(/^Signs in through /);
      expect(button.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Exactly one explanatory note, not two.
      expect(within(form).getAllByText(/^Signs in through /)).toHaveLength(1);
    }
    // Every account-name field uses the same placeholder.
    const names = screen.getAllByLabelText(/account name/i);
    expect(names).toHaveLength(10);
    for (const field of names) expect(field).toHaveAttribute('placeholder', 'Account name (optional)');
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
    await user.click(screen.getByRole('button', { name: /sign in to nexprint/i }));

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
    await user.click(screen.getByRole('button', { name: /sign in to creality cloud/i }));

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
    await user.click(screen.getByRole('button', { name: /sign in to makeronline/i }));

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

    // Opens on Printables alone rather than the top of the accounts list.
    expect(screen.getByRole('dialog', { name: 'Connect Printables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reconnect$/i })).toBeInTheDocument();
  });

  it('stores only an opaque Cults account id after browser-window sign-in', async () => {
    const connectCults = vi.fn().mockResolvedValue({
      ok: true,
      accountId: 'encrypted-account-123',
      label: 'Cults creator',
    });
    window.modelprepDesktop = { isDesktop: true, connectCults };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    const cultsButton = screen.getByRole('button', { name: /sign in to cults3d/i });
    const cultsForm = cultsButton.closest('.space-y-1\\.5');
    expect(within(cultsForm).queryByPlaceholderText('Password')).not.toBeInTheDocument();
    expect(within(cultsForm).queryByPlaceholderText('Cults3D email')).not.toBeInTheDocument();
    await user.click(cultsButton);

    expect(connectCults).toHaveBeenCalledWith({ label: '' });
    const serialized = localStorage.getItem('modelprep:accounts');
    expect(serialized).toContain('desktop-managed-cults-credentials-v1:encrypted-account-123');
    expect(serialized).not.toContain('password');
  });

  // ── AI tab ──────────────────────────────────────────────────────────────────
  // The panel's job: detect what this machine can already use, make picking it one click,
  // and explain any provider that is present but not working.

  // Codex installed and signed in; the other CLI agent absent, so assertions stay unambiguous.
  const codexReady = (models = [{ slug: 'gpt-5.5', label: 'GPT-5.5' }]) => ({
    isDesktop: true,
    cliAiStatus: vi.fn(async ({ agent }) => (agent === 'codex'
      ? { ok: true, available: true, signedIn: true, method: 'chatgpt', plan: 'ChatGPT', models }
      : { ok: true, available: false, signedIn: false, models: [] })),
    generateCliListing: vi.fn(),
  });
  const openAiTab = async (user) => {
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /^AI/i }));
  };
  const savedConfig = () => JSON.parse(localStorage.getItem('modelprep:ai-config'));

  it('starts with an honest empty state instead of a half-configured provider', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);

    expect(screen.getByText(/no ai picked yet/i)).toBeInTheDocument();
    // Key-based services are visible up front; CLIs and local runtimes that this
    // machine can't run live behind the collapsed "Advanced & local" group.
    for (const name of ['OpenRouter', 'Google Gemini']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /Codex CLI/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /advanced & local/i }));
    for (const name of ['Codex CLI', 'Ollama', 'LM Studio']) {
      expect(screen.getByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument();
    }
  });

  it('explains that local providers need the desktop app rather than offering a dead button', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);
    await user.click(screen.getByRole('button', { name: /advanced & local/i }));
    await user.click(screen.getByRole('button', { name: /Codex CLI/i }));

    expect(await screen.findByText(/cannot start a program on your computer/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^use this$/i })).not.toBeInTheDocument();
  });

  it('configures a detected provider in one click, model included', async () => {
    window.modelprepDesktop = codexReady();
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);

    await user.click(await screen.findByRole('button', { name: /^use this$/i }));
    expect(savedConfig()).toMatchObject({ version: 2, primary: 'codex', fallbacks: [] });
    expect(screen.getByText(/ModelPrep asks/i)).toHaveTextContent(/Codex CLI/);
  });

  it('lets the maker switch models from what the provider actually offers', async () => {
    window.modelprepDesktop = codexReady([{ slug: 'gpt-5.5', label: 'GPT-5.5' }, { slug: 'gpt-5.4', label: 'GPT-5.4' }]);
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);
    await user.click(await screen.findByRole('button', { name: /^use this$/i }));
    await user.click(screen.getByRole('button', { name: /Codex CLI/i }));

    const model = await screen.findByRole('combobox', { name: /model/i });
    expect(within(model).getByRole('option', { name: 'GPT-5.4' })).toBeInTheDocument();
    await user.selectOptions(model, 'gpt-5.4');
    expect(savedConfig().providers.codex.model).toBe('gpt-5.4');
  });

  it('separates a signed-out CLI from a missing one and names the command that fixes it', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      cliAiStatus: vi.fn(async ({ agent }) => ({ ok: true, available: agent === 'codex', signedIn: false, models: [] })),
      generateCliListing: vi.fn(),
    };
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);
    await user.click(await screen.findByRole('button', { name: /Codex CLI/i }));

    expect(await screen.findByText(/codex login/i)).toBeInTheDocument();
    expect(screen.getByText(/Installed, but signed out/i)).toBeInTheDocument();
  });

  it('detects a local model server and picks one of its vision models automatically', async () => {
    window.modelprepDesktop = {
      isDesktop: true,
      detectLocalAi: vi.fn(async () => ({ ok: true, ollama: { available: true, models: [{ slug: 'llama3.2-vision', label: 'llama3.2-vision' }] }, lmstudio: { available: false } })),
      localAiChat: vi.fn(),
    };
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);

    expect(await screen.findByText(/1 model that can read photos/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^use this$/i }));
    expect(savedConfig()).toMatchObject({ primary: 'ollama', providers: { ollama: { model: 'llama3.2-vision' } } });
  });

  it('tells the maker a rejected key is a sign-in problem, before any listing is generated', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Invalid API key' })));
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);
    await user.click(screen.getByRole('button', { name: /OpenRouter/i }));
    await user.type(screen.getByLabelText(/api key/i), 'sk-wrong');
    await user.click(screen.getByRole('button', { name: /check key/i }));

    expect(await screen.findByText(/sign-in problem/i)).toBeInTheDocument();
    expect(screen.getByText(/re-enter the key/i)).toBeInTheDocument();
  });

  it('accepts a working key, lists its vision models and can then be used', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: 'vision-a:free', name: 'Vision A', architecture: { input_modalities: ['text', 'image'] } }] }),
    })));
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);
    await user.click(screen.getByRole('button', { name: /OpenRouter/i }));
    await user.type(screen.getByLabelText(/api key/i), 'sk-good');
    await user.click(screen.getByRole('button', { name: /check key/i }));

    const model = await screen.findByRole('combobox', { name: /model/i });
    expect(within(model).getByRole('option', { name: 'Vision A' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /use for listings/i }));
    expect(savedConfig()).toMatchObject({ primary: 'openrouter', providers: { openrouter: { apiKey: 'sk-good', model: 'vision-a:free' } } });
  });

  it('builds a fallback chain and promotes the backup when the primary is removed', async () => {
    window.modelprepDesktop = {
      ...codexReady(),
      detectLocalAi: vi.fn(async () => ({ ok: true, ollama: { available: true, models: [{ slug: 'llama3.2-vision', label: 'llama3.2-vision' }] }, lmstudio: { available: false } })),
      localAiChat: vi.fn(),
    };
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);

    await user.click(await screen.findByRole('button', { name: /Codex CLI/i }));
    await user.click(screen.getByRole('button', { name: /use for listings/i }));
    await user.click(screen.getByRole('button', { name: /Ollama/i }));
    await user.click(screen.getByRole('button', { name: /add as backup/i }));

    expect(savedConfig()).toMatchObject({ primary: 'codex', fallbacks: ['ollama'] });
    expect(screen.getByText(/ModelPrep asks/i)).toHaveTextContent(/Codex CLI.*then Ollama if that fails/i);
    expect(screen.getByText(/backups take over automatically/i)).toBeInTheDocument();

    // Dropping the primary must not leave the maker with nothing while a backup is configured.
    await user.click(screen.getByRole('button', { name: /Codex CLI/i }));
    await user.click(screen.getByRole('button', { name: /remove from chain/i }));
    expect(savedConfig()).toMatchObject({ primary: 'ollama', fallbacks: [] });
  }, 20000);

  it('carries an older single-provider setup forward without losing the saved key', async () => {
    localStorage.setItem('modelprep:ai-config', JSON.stringify({ provider: 'groq', apiKey: 'sk-old', model: 'llama-vision' }));
    const user = userEvent.setup();
    render(<App />);
    await openAiTab(user);

    expect(screen.getByText(/ModelPrep asks/i)).toHaveTextContent(/Groq/);
    await user.click(screen.getByRole('button', { name: /Groq/i }));
    expect(screen.getByLabelText(/api key/i)).toHaveValue('sk-old');
  });

  it('Help tab explains the flow and defines the domain terms', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /^Help/i }));

    expect(screen.getByText(/how modelprep works/i)).toBeInTheDocument();
    expect(screen.getByText(/^3MF$/)).toBeInTheDocument();
    expect(screen.getByText(/^Focal point$/)).toBeInTheDocument();
    expect(screen.getByText(/nothing goes public unless you choose it/i)).toBeInTheDocument();
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
    // AI tab content (the provider list) is now visible.
    expect(screen.getByText(/writing your listings/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OpenRouter/i })).toBeInTheDocument();
  });
});
