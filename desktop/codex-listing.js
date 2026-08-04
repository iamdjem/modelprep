// Local Codex CLI listing generation — lets a maker use the ChatGPT/Codex subscription they
// already pay for instead of a metered API key.
//
// Why this lives in the desktop app: `codex` is a CLI, not an HTTP endpoint, so the browser
// build can never reach it (same reason Ollama is browser-direct and everything else is
// proxied). Electron's main process CAN spawn it, and the ChatGPT credentials stay in
// $CODEX_HOME — they never enter the renderer, the Worker, or this repo.
//
// The renderer sends the same prompt it builds for every other provider; this module owns the
// CLI invariants: a fixed output schema (so the reply is machine-readable JSON), a read-only
// sandbox, `--ignore-user-config` (a maker's own default model may be one their CLI cannot
// run, and we do not want their MCP servers/skills loaded for a photo caption), and a temp
// workspace that is deleted whatever happens.

const path = require('node:path');
const { childEnv, defaultRun, findBinary, withTempDir, writeImages } = require('./cli-process');

const DEFAULT_TIMEOUT_MS = 180_000;
const STATUS_TIMEOUT_MS = 15_000;
const MODELS_TIMEOUT_MS = 20_000;      // `codex debug models` refreshes the catalog over the network
const MAX_PROMPT_CHARS = 12_000;
const MAX_CATALOG_CHARS = 4_000_000;        // the model catalog is ~180 KB and must not be clipped

// Mirrors the JSON keys the renderer's prompt asks for. Passed to `--output-schema` so the
// final message is strict JSON instead of prose the parser has to dig through.
const CODEX_LISTING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'tags', 'category', 'realPhotoDetected', 'notes'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    category: { type: 'string' },
    realPhotoDetected: { type: 'boolean' },
    notes: { type: 'string' },
  },
};

/** Codex-specific wrappers over the shared CLI plumbing. */
async function findCodexBinary({ binPath, env, home, isExecutable } = {}) {
  return findBinary({ name: 'codex', binPath, env, home, isExecutable });
}

function codexEnv(options = {}) { return childEnv(options); }

/** Arg list for one non-interactive listing run. Prompt arrives on stdin (the trailing `-`),
 *  which also terminates the variadic `-i` so no image path can be read as the prompt. */
function buildCodexArgs({ imagePaths = [], workdir, schemaPath, outputPath, model }) {
  const args = [
    'exec',
    '--ignore-user-config',
    '--ephemeral',            // no session files left on disk
    '--skip-git-repo-check',
    '-C', workdir,
    '-s', 'read-only',
    '--color', 'never',
    '--output-schema', schemaPath,
    '-o', outputPath,
  ];
  const trimmedModel = String(model || '').trim();
  if (trimmedModel) args.push('-m', trimmedModel);
  for (const file of imagePaths) args.push('-i', file);
  args.push('-');
  return args;
}

/** Is the CLI installed and signed in? Drives the "Codex is ready / sign in first" hint in
 *  Settings so a maker never discovers the problem mid-generation. */
async function codexStatus({ binPath, env, home, isExecutable, run, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
  const bin = await findCodexBinary({ binPath, env, home, isExecutable });
  if (!bin) return { available: false, signedIn: false, binPath: null, error: 'codex CLI not found' };
  const exec = run || defaultRun();
  let result;
  try {
    result = await exec({ bin, args: ['login', 'status'], stdin: '', timeoutMs, env: codexEnv({ env, home, binPath: bin }) });
  } catch (err) {
    return { available: true, signedIn: false, binPath: bin, error: String(err?.message || err) };
  }
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  if (result.timedOut) return { available: true, signedIn: false, binPath: bin, error: 'codex login status timed out' };
  const signedIn = result.code === 0 && /logged in/i.test(output);
  return {
    available: true,
    signedIn,
    binPath: bin,
    // "Logged in using ChatGPT" vs an API key — worth surfacing, since only the former is
    // the subscription the maker is trying to reuse.
    method: /chatgpt/i.test(output) ? 'chatgpt' : (signedIn ? 'api-key' : null),
    plan: /chatgpt/i.test(output) ? 'ChatGPT' : null,
    error: signedIn ? null : (output.slice(0, 300) || `codex login status exited ${result.code}`),
  };
}

/** Vision-capable models this login can actually run, best first — the Model dropdown in AI
 *  settings. `codex debug models` refreshes the catalog from the account, so the list reflects
 *  the maker's own plan rather than anything hard-coded here. Text-only models are filtered
 *  out: every listing in this app starts from photos, so they could only ever fail. Returns an
 *  empty list (never throws) when the catalog is unavailable — the UI then falls back to a
 *  free-text model box. */
async function listCodexModels({ binPath, env, home, isExecutable, run, timeoutMs = MODELS_TIMEOUT_MS } = {}) {
  const bin = await findCodexBinary({ binPath, env, home, isExecutable });
  if (!bin) return { models: [], error: 'codex CLI not found' };
  const exec = run || defaultRun();
  let result;
  try {
    result = await exec({
      bin, args: ['debug', 'models'], stdin: '', timeoutMs,
      env: codexEnv({ env, home, binPath: bin }),
      maxOutputChars: MAX_CATALOG_CHARS, // the catalog carries per-model instructions; it is big
    });
  } catch (err) {
    return { models: [], error: String(err?.message || err) };
  }
  if (result.timedOut) return { models: [], error: 'codex debug models timed out' };
  return { models: parseCodexModels(result.stdout), error: result.code === 0 ? null : `codex debug models exited ${result.code}` };
}

function parseCodexModels(stdout) {
  let catalog;
  try { catalog = JSON.parse(String(stdout || '').trim()); } catch { return []; }
  const models = Array.isArray(catalog?.models) ? catalog.models : [];
  return models
    .filter((m) => m?.slug
      && m.visibility !== 'hide'                            // internal/auto-review entries
      && (m.input_modalities || []).includes('image'))      // no photos ⇒ no listing
    .sort((a, b) => (Number(a.priority) || 999) - (Number(b.priority) || 999))
    .map((m) => ({ slug: String(m.slug), label: String(m.display_name || m.slug) }));
}

/**
 * Run one listing generation through the local Codex CLI.
 * Returns the model's final message as text; the renderer parses it with the same
 * `parseAiListing` it uses for every other provider. Throws with a maker-readable message.
 */
async function generateCodexListing(input = {}, deps = {}) {
  const fs = deps.fs || require('node:fs/promises');
  const run = deps.run || defaultRun();
  const timeoutMs = Number(input.timeoutMs) > 0 ? Number(input.timeoutMs) : DEFAULT_TIMEOUT_MS;

  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('no prompt supplied');
  if (prompt.length > MAX_PROMPT_CHARS) throw new Error('prompt too long');

  const bin = await findCodexBinary({ binPath: input.binPath, env: deps.env, home: deps.home, isExecutable: deps.isExecutable });
  if (!bin) throw new Error('codex CLI not found — install it and sign in with your ChatGPT account');

  return withTempDir({ fs, tmpdir: deps.tmpdir, name: 'modelprep-codex-' }, async (dir) => {
    const workdir = path.join(dir, 'work');
    await fs.mkdir(workdir, { recursive: true });
    const imagePaths = await writeImages({ images: input.images, dir, fs });
    if (!imagePaths.length) throw new Error('no usable images supplied');

    const schemaPath = path.join(dir, 'listing-schema.json');
    const outputPath = path.join(dir, 'listing.json');
    await fs.writeFile(schemaPath, JSON.stringify(CODEX_LISTING_SCHEMA));

    const result = await run({
      bin,
      args: buildCodexArgs({ imagePaths, workdir, schemaPath, outputPath, model: input.model }),
      stdin: prompt,
      timeoutMs,
      env: codexEnv({ env: deps.env, home: deps.home, binPath: bin }),
    });
    if (result.timedOut) throw new Error('codex timed out');

    // Preferred source is the `-o` file; stdout also carries the message but is wrapped in the
    // CLI's own header/footer, so it is only a fallback.
    let text = '';
    try { text = String(await fs.readFile(outputPath, 'utf8')).trim(); } catch { /* not written */ }
    if (!text && result.code === 0) text = lastJsonBlock(result.stdout);
    if (!text) throw new Error(codexFailureMessage(result));
    return { text, binPath: bin };
  });
}

/** Last {...} block in the CLI's stdout — used only when `-o` produced nothing. */
function lastJsonBlock(stdout) {
  const raw = String(stdout || '');
  const end = raw.lastIndexOf('}');
  const start = raw.lastIndexOf('{', end);
  return end > start && start >= 0 ? raw.slice(start, end + 1).trim() : '';
}

/** Turn a failed run into something a maker can act on rather than a raw stack of CLI noise. */
function codexFailureMessage(result) {
  const noise = `${result?.stderr || ''}\n${result?.stdout || ''}`;
  const apiError = noise.match(/"message"\s*:\s*"([^"]{5,300})"/);
  if (apiError) return `codex: ${apiError[1]}`;
  if (/not (logged in|authenticated)|please (run )?codex login/i.test(noise)) {
    return 'codex is not signed in — run `codex login` and choose "Sign in with ChatGPT"';
  }
  const line = noise.split('\n').map((l) => l.trim()).filter(Boolean).pop();
  return line ? `codex failed: ${line.slice(0, 300)}` : `codex exited ${result?.code}`;
}

module.exports = {
  CODEX_LISTING_SCHEMA,
  buildCodexArgs,
  codexEnv,
  codexFailureMessage,
  codexStatus,
  findCodexBinary,
  generateCodexListing,
  listCodexModels,
  parseCodexModels,
};
