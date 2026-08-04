// AI providers: who writes the listing, how ModelPrep finds them, and what to say when one
// stops working.
//
// Three kinds of provider, and the difference decides everything else:
//   cli        — a program on this machine (Codex). Desktop only; a web page cannot spawn one.
//   local-http — a server on this machine (Ollama, LM Studio). Free, private, no key.
//   cloud      — someone else's API, with the maker's own key.
//
// A maker picks a primary and, optionally, backups. When the primary fails — expired key,
// monthly quota gone, Ollama not running — the next one in the chain takes over instead of
// dumping them back to an offline draft with a stack trace.

export const AI_PROVIDERS = {
  codex: {
    id: 'codex',
    agent: 'codex',
    name: 'Codex CLI',
    kind: 'cli',
    desktopOnly: true,
    cost: 'Included in your ChatGPT plan',
    blurb: 'Uses the Codex CLI you are already signed in to. No API key, nothing billed per listing.',
    setupUrl: 'https://openai.com/codex',
    setupHint: 'Install Codex, then run `codex login` and choose “Sign in with ChatGPT”.',
  },
  claudecode: {
    id: 'claudecode',
    agent: 'claude',
    name: 'Claude Code CLI',
    kind: 'cli',
    desktopOnly: true,
    cost: 'Included in your Claude plan',
    blurb: 'Uses the Claude Code CLI you are already signed in to. No API key, nothing billed per listing.',
    setupUrl: 'https://claude.com/claude-code',
    setupHint: 'Install Claude Code, then run `claude auth login` and sign in with your Claude account.',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    kind: 'local-http',
    baseUrl: 'http://localhost:11434/v1',
    cost: 'Free — runs on this computer',
    blurb: 'Open-source models on your own hardware. Your photos never leave the machine.',
    setupUrl: 'https://ollama.com',
    setupHint: 'Install Ollama, then run `ollama pull llama3.2-vision`.',
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    kind: 'local-http',
    baseUrl: 'http://localhost:1234/v1',
    cost: 'Free — runs on this computer',
    blurb: 'Local models with a desktop UI. Start its server and load a vision model.',
    setupUrl: 'https://lmstudio.ai',
    setupHint: 'In LM Studio, load a vision model and start the local server.',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    kind: 'cloud',
    needsKey: true,
    cost: 'Your own key — pay per listing',
    blurb: 'Claude reads photos closely and writes well. Best quality per listing if you have a key.',
    setupUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-opus-5',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    kind: 'cloud',
    needsKey: true,
    cost: 'Your own key — pay per listing',
    blurb: 'GPT models with vision, on a standard OpenAI API key.',
    setupUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'cloud',
    needsKey: true,
    cost: 'Your own key — free models available',
    blurb: 'One key, many models, including free ones.',
    setupUrl: 'https://openrouter.ai/keys',
    defaultModel: 'meta-llama/llama-3.2-11b-vision-instruct:free',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    kind: 'cloud',
    needsKey: true,
    cost: 'Your own key — generous free tier',
    blurb: 'Gemini Flash reads photos well and is free up to a daily limit.',
    setupUrl: 'https://aistudio.google.com/apikey',
    defaultModel: 'gemini-2.0-flash',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    kind: 'cloud',
    needsKey: true,
    cost: 'Your own key — free tier',
    blurb: 'Very fast Llama vision models.',
    setupUrl: 'https://console.groq.com/keys',
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
  xai: {
    id: 'xai',
    name: 'xAI Grok',
    kind: 'cloud',
    needsKey: true,
    cost: 'Your own key — pay per listing',
    blurb: 'Grok vision models on an xAI key.',
    setupUrl: 'https://console.x.ai',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    kind: 'cloud',
    needsKey: true,
    cost: 'Your own key — free tier available',
    blurb: 'Pixtral vision models, European hosting.',
    setupUrl: 'https://console.mistral.ai/api-keys',
  },
  custom: {
    id: 'custom',
    name: 'Custom endpoint',
    kind: 'cloud',
    needsKey: true,
    custom: true,
    cost: 'Anything OpenAI-compatible',
    blurb: 'Any /chat/completions endpoint: a self-hosted gateway, a proxy, a work account.',
  },
};

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS);
export const AI_CONFIG_KEY = 'modelprep:ai-config';
const CONFIG_VERSION = 2;

export function providerMeta(id) { return AI_PROVIDERS[id] || null; }
export function isLocalProvider(id) { return ['cli', 'local-http'].includes(AI_PROVIDERS[id]?.kind); }

/** Empty config: nobody picked yet, so listings fall back to the offline draft. */
export function emptyAiConfig() {
  return { version: CONFIG_VERSION, primary: '', fallbacks: [], providers: {} };
}

/**
 * Accepts either shape and always returns v2. v1 was flat
 * (`{provider, apiKey, model, baseUrl, binPath}`) with a single provider and no backups;
 * makers upgrading must not lose the key they already pasted.
 */
export function migrateAiConfig(raw) {
  const base = emptyAiConfig();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.version === CONFIG_VERSION || raw.providers) {
    const providers = {};
    for (const [id, settings] of Object.entries(raw.providers || {})) {
      if (AI_PROVIDERS[id]) providers[id] = { ...settings };
    }
    return {
      version: CONFIG_VERSION,
      primary: AI_PROVIDERS[raw.primary] ? raw.primary : '',
      fallbacks: (Array.isArray(raw.fallbacks) ? raw.fallbacks : [])
        .filter((id) => AI_PROVIDERS[id] && id !== raw.primary)
        .filter((id, i, all) => all.indexOf(id) === i),
      providers,
    };
  }
  const legacy = String(raw.provider || '');
  if (!AI_PROVIDERS[legacy]) return base;                       // includes the old 'none'
  base.primary = legacy;
  base.providers[legacy] = {};
  for (const key of ['apiKey', 'model', 'baseUrl', 'binPath']) {
    if (raw[key]) base.providers[legacy][key] = raw[key];
  }
  return base;
}

export function readAiConfig(storage = safeStorage()) {
  try { return migrateAiConfig(JSON.parse(storage?.getItem(AI_CONFIG_KEY) || 'null')); }
  catch { return emptyAiConfig(); }
}

export function writeAiConfig(config, storage = safeStorage()) {
  try { storage?.setItem(AI_CONFIG_KEY, JSON.stringify(config)); } catch { /* quota */ }
  return config;
}

function safeStorage() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

export function providerSettings(config, id) { return config?.providers?.[id] || {}; }

/** Providers to try, in order: the primary first, then each backup. */
export function aiChain(config) {
  const chain = [config?.primary, ...(config?.fallbacks || [])];
  return chain.filter((id, i) => id && AI_PROVIDERS[id] && chain.indexOf(id) === i);
}

/** Make `id` the primary, keeping the previous primary as the first backup — switching
 *  providers because one ran out of quota should not throw away the other one. */
export function setPrimaryProvider(config, id, settings = {}) {
  const previous = config.primary;
  const next = {
    ...config,
    primary: id,
    fallbacks: [previous, ...(config.fallbacks || [])]
      .filter((f, i, all) => f && f !== id && AI_PROVIDERS[f] && all.indexOf(f) === i),
    providers: { ...config.providers, [id]: { ...providerSettings(config, id), ...settings } },
  };
  return next;
}

export function addFallbackProvider(config, id) {
  if (!AI_PROVIDERS[id] || id === config.primary) return config;
  if ((config.fallbacks || []).includes(id)) return config;
  return { ...config, fallbacks: [...(config.fallbacks || []), id] };
}

export function removeProvider(config, id) {
  const fallbacks = (config.fallbacks || []).filter((f) => f !== id);
  if (config.primary !== id) return { ...config, fallbacks };
  // Promote the first backup so removing the primary never leaves the chain empty while a
  // perfectly good provider is still configured.
  return { ...config, primary: fallbacks[0] || '', fallbacks: fallbacks.slice(1) };
}

export function updateProviderSettings(config, id, settings) {
  return { ...config, providers: { ...config.providers, [id]: { ...providerSettings(config, id), ...settings } } };
}

// ── Errors ────────────────────────────────────────────────────────────────────
// Everything a provider can throw becomes one of these, so the UI can explain the failure
// and say what to do instead of printing a transport error at a maker.

// Order matters: the first match wins, so unambiguous signals go first. "timed out" is
// unmistakable, while a stray word like "model" shows up in plenty of unrelated messages.
const ERROR_RULES = [
  { code: 'timeout', test: /timed out|timeout|etimedout/i, title: 'Took too long', fix: 'Try fewer photos, or pick a faster model.' },
  {
    code: 'quota',
    status: [402, 429],
    test: /quota|rate.?limit|too many requests|insufficient|credits?|usage limit|billing|exceeded|out of/i,
    title: 'Out of quota',
    fix: 'Wait for the limit to reset, or switch to another provider. A backup provider takes over automatically.',
  },
  {
    code: 'auth',
    status: [401, 403],
    test: /unauthorized|forbidden|invalid.{0,12}(key|token|credential)|not (logged in|authenticated|signed in)|api key|codex login|authentication/i,
    title: 'Sign-in problem',
    fix: 'The key or login was rejected. Re-enter the key, or sign in again.',
  },
  {
    code: 'model',
    status: [404],
    test: /model|not supported|does not exist|no such|unsupported|requires a newer/i,
    title: 'Model unavailable',
    fix: 'This model is not available to your account. Pick a different one.',
  },
  {
    code: 'offline',
    test: /not found|econnrefused|failed to fetch|network|enotfound|connection refused|not running|unreachable|socket/i,
    title: 'Cannot reach it',
    fix: 'The provider is not running or not installed on this computer. Start it, then check again.',
  },
];

const asClassified = (rule, detail) => ({ code: rule.code, title: rule.title, fix: rule.fix, detail });

/** Classify a failure into { code, title, detail, fix }. `detail` keeps the provider's own
 *  words — makers forward those to support, and hiding them helps nobody. */
export function classifyAiError(error, status) {
  const detail = String(error?.message || error || '').trim();
  const httpStatus = Number(status) || Number(detail.match(/\b(4\d\d|5\d\d)\b/)?.[1]) || 0;
  // An HTTP status is decisive when a rule claims it; otherwise fall back to the wording,
  // which is all a transport-level failure ever gives us.
  const byStatus = ERROR_RULES.find((rule) => (rule.status || []).includes(httpStatus));
  if (byStatus) return asClassified(byStatus, detail);
  const byMessage = ERROR_RULES.find((rule) => rule.test.test(detail));
  if (byMessage) return asClassified(byMessage, detail);
  if (httpStatus >= 500) {
    return { code: 'offline', title: 'Provider is having trouble', fix: 'The service returned an error. Try again shortly, or switch provider.', detail };
  }
  return { code: 'unknown', title: 'Something went wrong', fix: 'Check the details below, or try another provider.', detail };
}

/**
 * Walk the chain until one provider produces a listing.
 * `callers` maps a provider id to an async function returning the parsed fields.
 * Always resolves: `{ ok, providerId?, fields?, attempts: [{ providerId, error }] }`, so the
 * caller can report exactly which providers were tried and why each declined.
 */
export async function runListingChain({ chain, callers, onAttempt }) {
  const attempts = [];
  for (const providerId of chain || []) {
    const call = callers?.[providerId];
    if (typeof call !== 'function') continue;
    onAttempt?.(providerId);
    try {
      const fields = await call();
      return { ok: true, providerId, fields, attempts };
    } catch (error) {
      attempts.push({ providerId, error: classifyAiError(error) });
    }
  }
  return { ok: false, attempts };
}

// ── Detection ─────────────────────────────────────────────────────────────────
// What can this machine actually use right now? Everything a maker needs to start is either
// already installed or one paste away, and the panel should say which without being asked.

export const DETECT_UNKNOWN = { state: 'unknown', models: [] };

/**
 * Probe every provider that can be probed without a key.
 * Returns `{ [id]: { state, models, detail, error } }` where state is one of
 * `ready` | `setup` | `missing` | `unsupported`. Never throws: a provider that cannot be
 * reached is a state to show, not an exception to handle.
 */
export async function detectProviders({ desktop } = {}) {
  const result = {};
  for (const id of AI_PROVIDER_IDS) {
    const meta = AI_PROVIDERS[id];
    if (meta.desktopOnly && !desktop) {
      result[id] = { state: 'unsupported', models: [], detail: 'Needs the ModelPrep desktop app' };
    } else if (meta.kind === 'cloud') {
      result[id] = { state: 'key', models: [], detail: meta.cost };
    } else {
      result[id] = { state: 'checking', models: [] };
    }
  }

  if (desktop?.cliAiStatus) {
    // Each CLI agent is probed the same way; only the copy differs per agent.
    for (const id of AI_PROVIDER_IDS.filter((p) => AI_PROVIDERS[p].kind === 'cli')) {
      result[id] = await probeCliAgent(desktop, AI_PROVIDERS[id]);
    }
  }
  if (desktop?.detectLocalAi) {
    const local = await desktop.detectLocalAi().catch((error) => ({ ok: false, error: String(error?.message || error) }));
    for (const id of ['ollama', 'lmstudio']) {
      result[id] = fromLocalProbe(local?.[id], local?.ok === false ? local.error : null);
    }
  } else {
    // Browser build: a page cannot reach a local server unless that server allows this
    // origin, and it cannot start one at all. Say so rather than showing a dead "Ready".
    for (const id of ['ollama', 'lmstudio']) {
      result[id] = { state: 'unsupported', models: [], detail: 'Needs the ModelPrep desktop app' };
    }
  }
  return result;
}

async function probeCliAgent(desktop, meta) {
  let status;
  try { status = await desktop.cliAiStatus({ agent: meta.agent }); }
  catch (error) { return { state: 'missing', models: [], detail: String(error?.message || error) }; }

  if (!status?.available) {
    return { state: 'missing', models: [], detail: 'Not installed on this computer' };
  }
  if (!status.signedIn) {
    return { state: 'setup', models: [], detail: 'Installed, but signed out', error: { code: 'auth', message: meta.setupHint } };
  }
  // A CLI signed in with an API key bills that key instead of the plan the maker picked this
  // provider for — worth saying plainly rather than letting an invoice explain it later.
  const billed = status.method === 'api-key';
  return {
    state: 'ready',
    models: status.models || [],
    detail: billed
      ? 'Signed in with an API key — billed to that key'
      : (status.plan ? `Signed in — ${status.plan} plan` : 'Signed in'),
    warning: billed
      ? `${meta.name} is signed in with an API key, so runs are billed to it, not to your plan. Sign out and sign back in with your account to use the subscription.`
      : null,
  };
}

function fromLocalProbe(probe, bridgeError) {
  if (bridgeError) return { state: 'missing', models: [], detail: bridgeError };
  if (!probe) return { state: 'missing', models: [], detail: 'Not running on this computer' };
  if (!probe.available) return { state: 'missing', models: [], detail: probe.error?.message || 'Not running on this computer' };
  if (!probe.models?.length) {
    return { state: 'setup', models: [], detail: 'Running, but no vision model', error: { code: 'model', message: probe.error?.message || 'Install a model that can read photos.' } };
  }
  const count = probe.models.length;
  return { state: 'ready', models: probe.models, detail: `${count} model${count === 1 ? '' : 's'} that can read photos` };
}

/** Validate a cloud key and list its models in one step, so "does my key work?" is answered
 *  before a maker waits on a real generation. Resolves to `{ ok, models, error }`. */
export async function checkCloudProvider({ id, apiKey, baseUrl, fetchImpl = fetch }) {
  const meta = AI_PROVIDERS[id];
  if (!meta || meta.kind !== 'cloud') return { ok: false, models: [], error: classifyAiError('unknown provider') };
  const key = String(apiKey || '').trim();
  if (!key) return { ok: false, models: [], error: { code: 'auth', title: 'Key needed', fix: `Paste a key from ${meta.setupUrl || 'your provider'}.`, detail: '' } };
  const root = String(baseUrl || CLOUD_BASE_URLS[id] || '').replace(/\/$/, '');
  if (!root) return { ok: false, models: [], error: { code: 'unknown', title: 'Endpoint needed', fix: 'Enter the base URL of your OpenAI-compatible endpoint.', detail: '' } };

  let res;
  try { res = await fetchImpl(`${root}/models`, { headers: cloudAuthHeaders(id, key) }); }
  catch (error) { return { ok: false, models: [], error: classifyAiError(error) }; }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, models: [], error: classifyAiError(new Error(detail.slice(0, 300) || `HTTP ${res.status}`), res.status) };
  }
  const body = await res.json().catch(() => null);
  return { ok: true, models: parseCloudModels(id, body), error: null };
}

export const CLOUD_BASE_URLS = {
  anthropic: 'https://api.anthropic.com/v1',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
};

/** Anthropic authenticates with `x-api-key` plus a version header rather than a bearer token;
 *  everyone else here is OpenAI-shaped. Sending the wrong one reads as a bad key. */
export function cloudAuthHeaders(id, key) {
  if (id === 'anthropic') return { 'x-api-key': key, 'anthropic-version': '2023-06-01' };
  return { authorization: `Bearer ${key}` };
}

/** OpenRouter publishes input modalities and Anthropic publishes an `image_input` capability,
 *  so both lists can be narrowed to models that can actually see. The others only return ids —
 *  listing them all beats listing none. */
export function parseCloudModels(id, body) {
  const rows = Array.isArray(body?.data) ? body.data : [];
  const mapped = rows
    .filter((m) => {
      const vision = m?.capabilities?.image_input?.supported;
      if (typeof vision === 'boolean') return vision;
      const modalities = m?.architecture?.input_modalities;
      return !Array.isArray(modalities) || modalities.includes('image');
    })
    .map((m) => ({ slug: String(m?.id || ''), label: String(m?.display_name || m?.name || m?.id || '') }))
    .filter((m) => m.slug);
  if (id !== 'openrouter') return mapped.slice(0, 200);
  // Free models first: they are why most makers choose OpenRouter.
  return [...mapped].sort((a, b) => Number(b.slug.endsWith(':free')) - Number(a.slug.endsWith(':free'))).slice(0, 200);
}

/** One sentence for the maker after a chain runs out — names the provider and the reason. */
export function chainFailureMessage(attempts = []) {
  if (!attempts.length) return 'No AI provider is set up yet, so ModelPrep wrote an offline draft.';
  const parts = attempts.map(({ providerId, error }) => `${AI_PROVIDERS[providerId]?.name || providerId}: ${error.title.toLowerCase()}`);
  return `${parts.join('; ')}. Wrote an offline draft instead.`;
}
