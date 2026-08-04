// Shared plumbing for running a local AI CLI (Codex, Claude Code) from the desktop app.
//
// Every CLI agent needs the same four things, and none of them are agent-specific: find the
// program on a PATH that a Finder-launched app doesn't have, run it with a timeout and bounded
// output, hand it the photos as files on disk, and clean up afterwards. The agent-specific part
// — arguments, status output, result shape — lives in each adapter.

const path = require('node:path');
const os = require('node:os');

const MAX_CAPTURE_CHARS = 20_000;      // keep a runaway CLI from filling memory
const MAX_IMAGES = 8;                  // matches the Worker/AI adapter cap
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Extensions the CLIs accept. Anything else is dropped rather than guessed at.
const IMAGE_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

// A packaged Mac app launched from Finder inherits a bare PATH (/usr/bin:/bin:/usr/sbin:/sbin),
// so a CLI installed by npm, Homebrew or a vendor installer is almost never on it — even when
// the maker's terminal finds it instantly.
function searchDirs({ env = process.env, home = os.homedir(), extraDirs = [] } = {}) {
  const fromPath = String(env.PATH || '').split(path.delimiter).filter(Boolean);
  const wellKnown = [
    path.join(home, '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(home, '.bun', 'bin'),
    path.join(home, '.volta', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, 'bin'),
    ...extraDirs.map((dir) => (dir.startsWith('~') ? path.join(home, dir.slice(1)) : dir)),
  ];
  return [...new Set([...fromPath, ...wellKnown])];
}

async function defaultIsExecutable(file) {
  const fs = require('node:fs/promises');
  try { await fs.access(file, require('node:fs').constants.X_OK); return true; }
  catch { return false; }
}

/** First existing executable named `name`, or null. An explicit `binPath` always wins — and if
 *  it does not exist we return null rather than quietly running some other copy. */
async function findBinary({ name, binPath, env, home, extraDirs, isExecutable } = {}) {
  const check = isExecutable || defaultIsExecutable;
  const explicit = String(binPath || '').trim();
  if (explicit) return (await check(explicit)) ? explicit : null;
  for (const dir of searchDirs({ env, home, extraDirs })) {
    const candidate = path.join(dir, name);
    if (await check(candidate)) return candidate;
  }
  return null;
}

/** Child env: keep the maker's own environment (auth homes, proxies) and top up PATH so the CLI
 *  can find its own helpers when the app was launched from Finder. */
function childEnv({ env = process.env, home = os.homedir(), binPath, extraDirs } = {}) {
  const dirs = searchDirs({ env, home, extraDirs });
  if (binPath) dirs.unshift(path.dirname(binPath));
  return { ...env, PATH: [...new Set(dirs)].join(path.delimiter) };
}

function defaultRun({ spawn = require('node:child_process').spawn } = {}) {
  return ({ bin, args, stdin, timeoutMs, env, cwd, maxOutputChars = MAX_CAPTURE_CHARS }) => new Promise((resolve, reject) => {
    let child;
    try { child = spawn(bin, args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (err) { reject(err); return; }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    const capture = (current, chunk) => (current + String(chunk)).slice(-maxOutputChars);
    child.stdout?.on('data', (chunk) => { stdout = capture(stdout, chunk); });
    child.stderr?.on('data', (chunk) => { stderr = capture(stderr, chunk); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
    child.stdin?.on('error', () => { /* CLI exited before reading the prompt */ });
    child.stdin?.end(stdin == null ? '' : String(stdin));
  });
}

/** Decode the renderer's inline images onto disk — every CLI takes file paths, not data URLs. */
async function writeImages({ images, dir, fs, prefix = 'photo' }) {
  const files = [];
  for (const [index, image] of (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES).entries()) {
    const ext = IMAGE_EXTENSIONS.get(String(image?.mediaType || '').toLowerCase());
    const base64 = String(image?.base64 || '');
    if (!ext || !base64) continue;
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) continue;
    const file = path.join(dir, `${prefix}-${index + 1}${ext}`);
    await fs.writeFile(file, bytes);
    files.push(file);
  }
  return files;
}

/** Run `body` against a fresh temp directory, removed whatever happens. */
async function withTempDir({ fs, tmpdir = os.tmpdir(), name = 'modelprep-cli-' }, body) {
  const dir = await fs.mkdtemp(path.join(tmpdir, name));
  try { return await body(dir); }
  finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => { /* already gone */ }); }
}

module.exports = {
  IMAGE_EXTENSIONS,
  MAX_CAPTURE_CHARS,
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  childEnv,
  defaultRun,
  findBinary,
  searchDirs,
  withTempDir,
  writeImages,
};
