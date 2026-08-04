// Claude Code CLI as a listing writer — the Claude counterpart to codex-listing.js.
//
// Same bargain as Codex: a maker who already pays for a Claude plan gets photo-based listings
// with no API key and nothing billed per request. The credentials stay wherever Claude Code
// keeps them (keychain / ~/.claude) and never enter the renderer, the Worker, or this repo.
//
// The mechanics differ from Codex in two ways. Claude Code has no `-i` flag: it reads images
// with its Read tool, so the photos are written into the working directory and the prompt names
// them, with `--allowedTools Read` granting exactly that one capability and nothing else.
// And `--output-format json` wraps the reply in an envelope carrying `result` plus the error
// and permission-denial signals this module maps to maker-readable messages.

const path = require('node:path');
const { childEnv, defaultRun, findBinary, withTempDir, writeImages } = require('./cli-process');

const DEFAULT_TIMEOUT_MS = 240_000;   // reading photos takes a few tool calls
const STATUS_TIMEOUT_MS = 20_000;
const MAX_PROMPT_CHARS = 12_000;
const MAX_ENVELOPE_CHARS = 2_000_000; // the JSON envelope carries usage metadata around the reply

// Claude Code installs itself here in addition to the usual bin directories.
const EXTRA_DIRS = ['~/.claude/local'];

// Aliases rather than dated ids: the CLI resolves each to the current model in that tier, so a
// saved choice keeps working after a model refresh. Blank means "whatever the CLI defaults to".
const CLAUDE_MODELS = [
  { slug: 'opus', label: 'Claude Opus — most capable' },
  { slug: 'sonnet', label: 'Claude Sonnet — balanced' },
  { slug: 'haiku', label: 'Claude Haiku — fastest' },
];

async function locate({ binPath, env, home, isExecutable } = {}) {
  return findBinary({ name: 'claude', binPath, env, home, extraDirs: EXTRA_DIRS, isExecutable });
}

/** Is Claude Code installed, signed in, and on a plan rather than a metered key? */
async function claudeStatus({ binPath, env, home, isExecutable, run, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
  const bin = await locate({ binPath, env, home, isExecutable });
  if (!bin) return { available: false, signedIn: false, binPath: null, error: 'Claude Code CLI not found' };
  const exec = run || defaultRun();

  let result;
  try {
    result = await exec({ bin, args: ['auth', 'status'], stdin: '', timeoutMs, env: childEnv({ env, home, binPath: bin, extraDirs: EXTRA_DIRS }) });
  } catch (error) {
    return { available: true, signedIn: false, binPath: bin, error: String(error?.message || error) };
  }
  if (result.timedOut) return { available: true, signedIn: false, binPath: bin, error: 'claude auth status timed out' };

  let status = null;
  try { status = JSON.parse(String(result.stdout || '').trim()); } catch { /* not JSON */ }
  if (!status || typeof status !== 'object') {
    return { available: true, signedIn: false, binPath: bin, error: `${result.stderr || result.stdout || ''}`.trim().slice(0, 300) || 'could not read auth status' };
  }
  const signedIn = status.loggedIn === true;
  // `claude.ai` is the subscription sign-in; anything else means requests are billed to a key.
  const onPlan = String(status.authMethod || '').toLowerCase().includes('claude.ai');
  return {
    available: true,
    signedIn,
    binPath: bin,
    method: signedIn ? (onPlan ? 'subscription' : 'api-key') : null,
    plan: status.subscriptionType || null,
    account: status.email || null,
    models: signedIn ? CLAUDE_MODELS : [],
    error: signedIn ? null : 'not signed in',
  };
}

/** Args for one non-interactive listing run. `Read` is the only tool granted, the working
 *  directory holds nothing but the photos, and sessions are not persisted. */
function buildClaudeArgs({ model } = {}) {
  const args = [
    '-p',
    '--output-format', 'json',
    '--allowedTools', 'Read',
    '--no-session-persistence',
    '--strict-mcp-config',        // a maker's MCP servers have no business in a photo caption
  ];
  const trimmed = String(model || '').trim();
  if (trimmed) args.push('--model', trimmed);
  return args;
}

/** Photos live beside the prompt, so the prompt can simply name them. */
function buildClaudePrompt({ prompt, imagePaths }) {
  const names = imagePaths.map((file) => path.basename(file));
  const list = names.map((name) => `- ${name}`).join('\n');
  return [
    `Read these image files in the current directory:\n${list}`,
    '',
    prompt,
    '',
    'Reply with the JSON object only — no code fences, no commentary before or after it.',
  ].join('\n');
}

/** Pull the model's reply out of the `--output-format json` envelope. */
function parseClaudeEnvelope(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) return { text: '', error: 'no output' };
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch {
    // A plain-text fallback is better than failing outright if the envelope shape ever changes.
    return { text: raw, error: null };
  }
  if (envelope?.is_error) {
    return { text: '', error: String(envelope.result || envelope.error || 'claude reported an error').slice(0, 300) };
  }
  if (Array.isArray(envelope?.permission_denials) && envelope.permission_denials.length) {
    return { text: '', error: 'Claude Code was denied permission to read the photos' };
  }
  return { text: String(envelope?.result || '').trim(), error: null };
}

/**
 * Run one listing generation through the local Claude Code CLI.
 * Returns the model's reply as text; the renderer parses it with the same `parseAiListing` it
 * uses for every other provider. Throws with a maker-readable message.
 */
async function generateClaudeListing(input = {}, deps = {}) {
  const fs = deps.fs || require('node:fs/promises');
  const run = deps.run || defaultRun();
  const timeoutMs = Number(input.timeoutMs) > 0 ? Number(input.timeoutMs) : DEFAULT_TIMEOUT_MS;

  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('no prompt supplied');
  if (prompt.length > MAX_PROMPT_CHARS) throw new Error('prompt too long');

  const bin = await locate({ binPath: input.binPath, env: deps.env, home: deps.home, isExecutable: deps.isExecutable });
  if (!bin) throw new Error('Claude Code CLI not found — install it and sign in with your Claude account');

  return withTempDir({ fs, tmpdir: deps.tmpdir, name: 'modelprep-claude-' }, async (dir) => {
    const imagePaths = await writeImages({ images: input.images, dir, fs });
    if (!imagePaths.length) throw new Error('no usable images supplied');

    const result = await run({
      bin,
      args: buildClaudeArgs({ model: input.model }),
      stdin: buildClaudePrompt({ prompt, imagePaths }),
      cwd: dir,                    // the CLI reads the photos relative to here
      timeoutMs,
      maxOutputChars: MAX_ENVELOPE_CHARS,
      env: childEnv({ env: deps.env, home: deps.home, binPath: bin, extraDirs: EXTRA_DIRS }),
    });
    if (result.timedOut) throw new Error('claude timed out');

    const { text, error } = parseClaudeEnvelope(result.stdout);
    if (error) throw new Error(claudeFailureMessage({ ...result, detail: error }));
    if (!text) throw new Error(claudeFailureMessage(result));
    return { text, binPath: bin };
  });
}

/** Turn a failed run into something a maker can act on. */
function claudeFailureMessage(result) {
  const detail = String(result?.detail || '').trim();
  const noise = `${detail}\n${result?.stderr || ''}`;
  if (/not (logged in|authenticated)|invalid api key|unauthorized|authentication/i.test(noise)) {
    return 'Claude Code is not signed in — run `claude auth login` and sign in with your Claude account';
  }
  if (/usage limit|rate limit|quota|exceeded/i.test(noise)) {
    return `claude: ${detail || 'usage limit reached'}`;
  }
  if (detail) return `claude: ${detail}`;
  const line = noise.split('\n').map((l) => l.trim()).filter(Boolean).pop();
  return line ? `claude failed: ${line.slice(0, 300)}` : `claude exited ${result?.code}`;
}

module.exports = {
  CLAUDE_MODELS,
  buildClaudeArgs,
  buildClaudePrompt,
  claudeFailureMessage,
  claudeStatus,
  generateClaudeListing,
  parseClaudeEnvelope,
};
