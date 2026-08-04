import { describe, it, expect, vi } from 'vitest';
import {
  AI_PROVIDERS,
  addFallbackProvider,
  aiChain,
  chainFailureMessage,
  checkCloudProvider,
  classifyAiError,
  detectProviders,
  emptyAiConfig,
  migrateAiConfig,
  parseCloudModels,
  removeProvider,
  runListingChain,
  setPrimaryProvider,
} from './ai-providers.js';

describe('config migration', () => {
  it('carries a v1 setup forward without losing the key the maker already pasted', () => {
    const migrated = migrateAiConfig({ provider: 'openrouter', apiKey: 'sk-abc', model: 'llama-vision', baseUrl: '' });
    expect(migrated.primary).toBe('openrouter');
    expect(migrated.providers.openrouter).toEqual({ apiKey: 'sk-abc', model: 'llama-vision' });
    expect(migrated.fallbacks).toEqual([]);
  });

  it('treats the retired "none" provider and junk as no configuration', () => {
    expect(migrateAiConfig({ provider: 'none', model: 'x' })).toEqual(emptyAiConfig());
    expect(migrateAiConfig(null)).toEqual(emptyAiConfig());
    expect(migrateAiConfig('nonsense')).toEqual(emptyAiConfig());
  });

  it('drops unknown providers and a fallback duplicating the primary', () => {
    const migrated = migrateAiConfig({
      version: 2, primary: 'codex', fallbacks: ['codex', 'ollama', 'ollama', 'made-up'],
      providers: { codex: { model: 'gpt-5.5' }, 'made-up': { apiKey: 'x' } },
    });
    expect(migrated.fallbacks).toEqual(['ollama']);
    expect(Object.keys(migrated.providers)).toEqual(['codex']);
  });
});

describe('provider chain', () => {
  it('keeps the previous primary as the first backup when switching', () => {
    let config = setPrimaryProvider(emptyAiConfig(), 'codex', { model: 'gpt-5.5' });
    config = setPrimaryProvider(config, 'ollama', { model: 'llama3.2-vision' });
    expect(aiChain(config)).toEqual(['ollama', 'codex']);
    // Switching provider must not discard the settings of the one being demoted.
    expect(config.providers.codex.model).toBe('gpt-5.5');
  });

  it('never lists a provider twice, however it was added', () => {
    let config = setPrimaryProvider(emptyAiConfig(), 'codex');
    config = addFallbackProvider(config, 'ollama');
    config = addFallbackProvider(config, 'ollama');
    config = addFallbackProvider(config, 'codex');
    expect(aiChain(config)).toEqual(['codex', 'ollama']);
  });

  it('promotes a backup when the primary is removed', () => {
    let config = setPrimaryProvider(emptyAiConfig(), 'codex');
    config = addFallbackProvider(config, 'ollama');
    config = removeProvider(config, 'codex');
    expect(config.primary).toBe('ollama');
    expect(aiChain(config)).toEqual(['ollama']);
    expect(aiChain(removeProvider(config, 'ollama'))).toEqual([]);
  });
});

describe('error classification', () => {
  const cases = [
    ['quota', new Error('provider 429: Rate limit exceeded'), 429],
    ['quota', new Error('You have exceeded your monthly included credits'), 0],
    ['auth', new Error('provider 401: invalid api key'), 401],
    ['auth', new Error('codex is not signed in — run `codex login`'), 0],
    ['model', new Error("The 'gpt-5.1' model is not supported when using Codex with a ChatGPT account."), 0],
    ['offline', new Error('Ollama is not running on this computer.'), 0],
    ['offline', new Error('Failed to fetch'), 0],
    ['timeout', new Error('codex timed out'), 0],
    ['unknown', new Error('something bizarre'), 0],
  ];
  for (const [code, error, status] of cases) {
    it(`reads "${error.message.slice(0, 44)}" as ${code}`, () => {
      const classified = classifyAiError(error, status);
      expect(classified.code).toBe(code);
      // Every classification has to tell the maker what to do next, plus the raw words.
      expect(classified.fix.length).toBeGreaterThan(10);
      expect(classified.detail).toBe(error.message);
    });
  }

  it('reads a server-side failure as the provider being in trouble, not the maker', () => {
    expect(classifyAiError(new Error('boom'), 503).code).toBe('offline');
  });
});

describe('running the chain', () => {
  it('falls through to the next provider and reports what each one said', async () => {
    const order = [];
    const result = await runListingChain({
      chain: ['codex', 'ollama', 'openrouter'],
      onAttempt: (id) => order.push(id),
      callers: {
        codex: async () => { throw new Error('provider 429: quota exceeded'); },
        ollama: async () => { throw new Error('Ollama is not running on this computer.'); },
        openrouter: async () => ({ title: 'Desk Dragon' }),
      },
    });
    expect(order).toEqual(['codex', 'ollama', 'openrouter']);
    expect(result.ok).toBe(true);
    expect(result.providerId).toBe('openrouter');
    expect(result.fields.title).toBe('Desk Dragon');
    expect(result.attempts.map((a) => a.error.code)).toEqual(['quota', 'offline']);
  });

  it('stops at the first provider that works', async () => {
    const ollama = vi.fn();
    const result = await runListingChain({
      chain: ['codex', 'ollama'],
      callers: { codex: async () => ({ title: 'ok' }), ollama },
    });
    expect(result.providerId).toBe('codex');
    expect(ollama).not.toHaveBeenCalled();
  });

  it('explains a fully exhausted chain in one sentence', async () => {
    const result = await runListingChain({
      chain: ['codex'],
      callers: { codex: async () => { throw new Error('provider 401: invalid api key'); } },
    });
    expect(result.ok).toBe(false);
    expect(chainFailureMessage(result.attempts)).toMatch(/Codex CLI: sign-in problem/i);
    expect(chainFailureMessage([])).toMatch(/no ai provider is set up/i);
  });
});

describe('detection', () => {
  it('marks local providers unsupported in the browser build', async () => {
    const detected = await detectProviders({ desktop: null });
    expect(detected.codex.state).toBe('unsupported');
    expect(detected.ollama.state).toBe('unsupported');
    expect(detected.openrouter.state).toBe('key');
  });

  it('reads Codex and local servers through the desktop bridge', async () => {
    const detected = await detectProviders({
      desktop: {
        cliAiStatus: async ({ agent }) => (agent === 'codex'
          ? { available: true, signedIn: true, method: 'chatgpt', plan: 'ChatGPT', models: [{ slug: 'gpt-5.5', label: 'GPT-5.5' }] }
          : { available: true, signedIn: true, method: 'subscription', plan: 'max', models: [{ slug: 'opus', label: 'Claude Opus' }] }),
        detectLocalAi: async () => ({
          ok: true,
          ollama: { available: true, models: [{ slug: 'llama3.2-vision', label: 'llama3.2-vision' }] },
          lmstudio: { available: false, error: { code: 'offline', message: 'LM Studio is not running on this computer.' } },
        }),
      },
    });
    expect(detected.codex).toMatchObject({ state: 'ready', detail: 'Signed in — ChatGPT plan' });
    // Both CLI agents are probed through the one bridge call, each with its own copy.
    expect(detected.claudecode).toMatchObject({ state: 'ready', detail: 'Signed in — max plan' });
    expect(detected.ollama).toMatchObject({ state: 'ready', detail: '1 model that can read photos' });
    expect(detected.lmstudio).toMatchObject({ state: 'missing', detail: 'LM Studio is not running on this computer.' });
  });

  it('separates "installed but signed out" from "not installed"', async () => {
    const signedOut = await detectProviders({ desktop: { cliAiStatus: async () => ({ available: true, signedIn: false }) } });
    expect(signedOut.codex.state).toBe('setup');
    expect(signedOut.codex.error.message).toMatch(/codex login/);
    expect(signedOut.claudecode.error.message).toMatch(/claude auth login/);

    const missing = await detectProviders({ desktop: { cliAiStatus: async () => ({ available: false }) } });
    expect(missing.codex.state).toBe('missing');
  });

  it('flags a Codex signed in with an API key, which bills instead of using the plan', async () => {
    const detected = await detectProviders({
      desktop: { cliAiStatus: async () => ({ available: true, signedIn: true, method: 'api-key', models: [] }) },
    });
    expect(detected.codex.state).toBe('ready');
    expect(detected.codex.warning).toMatch(/billed/i);
  });

  it('reports a running server with no vision model as needing setup, not as broken', async () => {
    const detected = await detectProviders({
      desktop: {
        detectLocalAi: async () => ({ ok: true, ollama: { available: true, models: [], error: { code: 'model', message: 'No vision model is installed. Run `ollama pull llama3.2-vision`.' } } }),
      },
    });
    expect(detected.ollama.state).toBe('setup');
    expect(detected.ollama.error.message).toMatch(/ollama pull/);
  });
});

describe('cloud key check', () => {
  it('accepts a working key and lists the models it can use', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [
        { id: 'text-only', architecture: { input_modalities: ['text'] } },
        { id: 'vision-paid', name: 'Vision Paid', architecture: { input_modalities: ['text', 'image'] } },
        { id: 'vision-free:free', name: 'Vision Free', architecture: { input_modalities: ['text', 'image'] } },
      ] }),
    }));
    const result = await checkCloudProvider({ id: 'openrouter', apiKey: 'sk-abc', fetchImpl });
    expect(result.ok).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/models');
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe('Bearer sk-abc');
    // Text-only models are dropped, and free ones lead — that is why makers pick OpenRouter.
    expect(result.models.map((m) => m.slug)).toEqual(['vision-free:free', 'vision-paid']);
  });

  it('turns a rejected key and an exhausted account into distinct, fixable errors', async () => {
    const unauthorized = await checkCloudProvider({
      id: 'groq', apiKey: 'bad',
      fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'Invalid API Key' }),
    });
    expect(unauthorized.ok).toBe(false);
    expect(unauthorized.error.code).toBe('auth');

    const broke = await checkCloudProvider({
      id: 'openrouter', apiKey: 'sk-abc',
      fetchImpl: async () => ({ ok: false, status: 402, text: async () => 'Insufficient credits' }),
    });
    expect(broke.error.code).toBe('quota');
    expect(broke.error.fix).toMatch(/backup provider/i);
  });

  it('asks for a key before making a request when none is entered', async () => {
    const fetchImpl = vi.fn();
    const result = await checkCloudProvider({ id: 'gemini', apiKey: '  ', fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('auth');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps every model when the provider says nothing about modalities', () => {
    const models = parseCloudModels('groq', { data: [{ id: 'a' }, { id: 'b' }] });
    expect(models.map((m) => m.slug)).toEqual(['a', 'b']);
  });

  it('speaks Anthropic’s auth dialect and reads its vision capability flag', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [
        { id: 'claude-opus-5', display_name: 'Claude Opus 5', capabilities: { image_input: { supported: true } } },
        { id: 'text-only-model', display_name: 'Text Only', capabilities: { image_input: { supported: false } } },
      ] }),
    }));
    const result = await checkCloudProvider({ id: 'anthropic', apiKey: 'sk-ant-abc', fetchImpl });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/models');
    // Anthropic rejects a bearer token — sending one would read as a bad key.
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ 'x-api-key': 'sk-ant-abc', 'anthropic-version': '2023-06-01' });
    expect(result.models).toEqual([{ slug: 'claude-opus-5', label: 'Claude Opus 5' }]);
  });
});

describe('registry', () => {
  it('gives every provider the copy the panel renders', () => {
    for (const [id, meta] of Object.entries(AI_PROVIDERS)) {
      expect(meta.name, `${id} name`).toBeTruthy();
      expect(meta.cost, `${id} cost`).toBeTruthy();
      expect(['cli', 'local-http', 'cloud']).toContain(meta.kind);
      // A CLI provider is dispatched by its agent id, and its setup hint doubles as the
      // signed-out fix shown in the panel.
      if (meta.kind === 'cli') {
        expect(meta.agent, `${id} agent`).toBeTruthy();
        expect(meta.setupHint, `${id} setupHint`).toBeTruthy();
      }
      if (meta.kind === 'cloud' && !meta.custom) expect(meta.setupUrl, `${id} setupUrl`).toBeTruthy();
    }
  });

  it('covers both subscription CLIs and the popular key-based providers', () => {
    expect(Object.keys(AI_PROVIDERS).filter((id) => AI_PROVIDERS[id].kind === 'cli')).toEqual(['codex', 'claudecode']);
    for (const id of ['anthropic', 'openai', 'openrouter', 'gemini', 'groq', 'xai', 'mistral']) {
      expect(AI_PROVIDERS[id]?.kind, id).toBe('cloud');
    }
  });
});
