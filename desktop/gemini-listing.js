// Gemini CLI as a listing writer — the third local agent alongside codex-listing.js
// and claude-listing.js.
//
// Same bargain as the other two: a maker already signed in to Gemini CLI gets
// photo-based listings with no API key pasted into ModelPrep and nothing billed
// per request. Credentials stay wherever the CLI keeps them (~/.gemini) and never
// enter the renderer, the Worker, or this repo.
//
// Mechanics closest to Claude Code: Gemini CLI has no image flag, it reads files
// with its own read tool, so the photos are written into the working directory and
// the prompt names them. `-p` runs one non-interactive turn and prints the reply on
// stdout; there is no JSON envelope to unwrap, so the reply is used as-is.

const path = require('node:path');
const { childEnv, defaultRun, findBinary, withTempDir, writeImages } = require('./cli-process');

const DEFAULT_TIMEOUT_MS = 240_000;   // reading photos takes a few tool calls
const STATUS_TIMEOUT_MS = 20_000;
const MAX_PROMPT_CHARS = 12_000;
const MAX_OUTPUT_CHARS = 2_000_000;

// npm installs put the binary on PATH; these cover a user-local install.
const EXTRA_DIRS = ['~/.gemini/bin', '~/.local/bin'];

// Aliases, not dated ids, so a saved choice survives a model refresh. Blank means
// "whatever the CLI defaults to".
const GEMINI_MODELS = [
  { slug: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — most capable' },
  { slug: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — fastest' },
];

async function locate({ binPath, env, home, isExecutable } = {}) {
  return findBinary({ name: 'gemini', binPath, env, home, extraDirs: EXTRA_DIRS, isExecutable });
}

/**
 * Is Gemini CLI installed and signed in?
 *
 * The CLI has no `auth status` subcommand, so being signed in is inferred the only
 * way available: run a trivial prompt and see whether it answers. That also catches
 * the case the maker actually cares about, an install that runs but cannot reach a
 * model, which a version check alone would report as healthy.
 */
async function geminiStatus({ binPath, env, home, isExecutable, run, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
  const bin = await locate({ binPath, env, home, isExecutable });
  if (!bin) return { available: false, signedIn: false, binPath: null, error: 'Gemini CLI not found' };
  const exec = run || defaultRun();
  const childEnvironment = childEnv({ env, home, binPath: bin, extraDirs: EXTRA_DIRS });

  let result;
  try {
    result = await exec({ bin, args: ['-p', 'ok'], stdin: '', timeoutMs, env: childEnvironment });
  } catch (error) {
    return { available: true, signedIn: false, binPath: bin, error: String(error?.message || error) };
  }
  if (result.timedOut) return { available: true, signedIn: false, binPath: bin, error: 'gemini timed out' };

  const noise = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.code !== 0 || /not (logged in|authenticated)|authentication|no auth|sign in|GEMINI_API_KEY/i.test(noise)) {
    return {
      available: true,
      signedIn: false,
      binPath: bin,
      models: [],
      error: 'not signed in',
    };
  }
  // A key in the environment means requests are metered rather than on a plan.
  const usingKey = !!(childEnvironment.GEMINI_API_KEY || childEnvironment.GOOGLE_API_KEY);
  return {
    available: true,
    signedIn: true,
    binPath: bin,
    method: usingKey ? 'api-key' : 'subscription',
    plan: usingKey ? null : 'Google account',
    models: GEMINI_MODELS,
    error: null,
  };
}

/** Args for one non-interactive listing run. */
function buildGeminiArgs({ model } = {}) {
  const args = ['-p'];
  const trimmed = String(model || '').trim();
  if (trimmed) args.push('--model', trimmed);
  return args;
}

/** Photos live beside the prompt, so the prompt can simply name them. */
function buildGeminiPrompt({ prompt, imagePaths }) {
  const list = imagePaths.map((file) => `- ${path.basename(file)}`).join('\n');
  return [
    `Read these image files in the current directory:\n${list}`,
    '',
    prompt,
    '',
    'Reply with the JSON object only — no code fences, no commentary before or after it.',
  ].join('\n');
}

/**
 * Run one listing generation through the local Gemini CLI. Returns the reply as
 * text; the renderer parses it with the same `parseAiListing` every other provider
 * uses. Throws with a maker-readable message.
 */
async function generateGeminiListing(input = {}, deps = {}) {
  const fs = deps.fs || require('node:fs/promises');
  const run = deps.run || defaultRun();
  const timeoutMs = Number(input.timeoutMs) > 0 ? Number(input.timeoutMs) : DEFAULT_TIMEOUT_MS;

  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw new Error('no prompt supplied');
  if (prompt.length > MAX_PROMPT_CHARS) throw new Error('prompt too long');

  const bin = await locate({ binPath: input.binPath, env: deps.env, home: deps.home, isExecutable: deps.isExecutable });
  if (!bin) throw new Error('Gemini CLI not found — install it and run `gemini` once to sign in');

  return withTempDir({ fs, tmpdir: deps.tmpdir, name: 'modelprep-gemini-' }, async (dir) => {
    const imagePaths = await writeImages({ images: input.images, dir, fs });
    if (!imagePaths.length) throw new Error('no usable images supplied');

    const result = await run({
      bin,
      args: buildGeminiArgs({ model: input.model }),
      stdin: buildGeminiPrompt({ prompt, imagePaths }),
      cwd: dir,                    // the CLI reads the photos relative to here
      timeoutMs,
      maxOutputChars: MAX_OUTPUT_CHARS,
      env: childEnv({ env: deps.env, home: deps.home, binPath: bin, extraDirs: EXTRA_DIRS }),
    });
    if (result.timedOut) throw new Error('gemini timed out');

    const text = String(result.stdout || '').trim();
    if (result.code !== 0 || !text) throw new Error(geminiFailureMessage(result));
    return { text, binPath: bin };
  });
}

/** Turn a failed run into something a maker can act on. */
function geminiFailureMessage(result) {
  const detail = String(result?.detail || '').trim();
  const noise = `${detail}\n${result?.stderr || ''}`;
  if (/not (logged in|authenticated)|unauthorized|authentication|GEMINI_API_KEY|sign in/i.test(noise)) {
    return 'Gemini CLI is not signed in — run `gemini` once and sign in with your Google account';
  }
  if (/quota|rate limit|resource exhausted|exceeded/i.test(noise)) {
    return `gemini: ${detail || 'quota reached'}`;
  }
  if (detail) return `gemini: ${detail}`;
  const line = noise.split('\n').map((l) => l.trim()).filter(Boolean).pop();
  return line ? `gemini failed: ${line.slice(0, 300)}` : `gemini exited ${result?.code}`;
}

module.exports = {
  GEMINI_MODELS,
  buildGeminiArgs,
  buildGeminiPrompt,
  generateGeminiListing,
  geminiFailureMessage,
  geminiStatus,
};
