const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  CLAUDE_MODELS,
  buildClaudeArgs,
  buildClaudePrompt,
  claudeFailureMessage,
  claudeStatus,
  generateClaudeListing,
  parseClaudeEnvelope,
} = require('./claude-listing');

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const envelope = (fields) => JSON.stringify({ is_error: false, permission_denials: [], ...fields });

test('packaged desktop allowlist includes the Claude Code module and its shared plumbing', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('claude-listing.js'));
  assert.ok(packageJson.build.files.includes('cli-process.js'));
  assert.match(packageJson.scripts.test, /claude-listing\.test\.js/);
});

test('exec args grant exactly one tool and leave no session behind', () => {
  const args = buildClaudeArgs({ model: 'sonnet' });
  assert.ok(args.includes('-p'));
  assert.equal(args[args.indexOf('--output-format') + 1], 'json');
  // Read is the only capability this needs; granting more would hand a photo caption the
  // ability to write files or run commands.
  assert.equal(args[args.indexOf('--allowedTools') + 1], 'Read');
  assert.ok(args.includes('--no-session-persistence'));
  assert.ok(args.includes('--strict-mcp-config'));
  assert.equal(args[args.indexOf('--model') + 1], 'sonnet');
  // No model configured ⇒ let the CLI pick, rather than pinning a tier that may not fit the plan.
  assert.ok(!buildClaudeArgs({}).includes('--model'));
});

test('the prompt names the photo files that sit next to it', () => {
  const prompt = buildClaudePrompt({ prompt: 'Write the listing.', imagePaths: ['/tmp/x/photo-1.jpg', '/tmp/x/photo-2.png'] });
  assert.match(prompt, /- photo-1\.jpg/);
  assert.match(prompt, /- photo-2\.png/);
  assert.match(prompt, /Write the listing\./);
  // Bare file names only — the CLI runs with the temp directory as its working directory.
  assert.ok(!prompt.includes('/tmp/x/'));
});

test('the JSON envelope is unwrapped, and its failure signals are surfaced', () => {
  assert.deepEqual(parseClaudeEnvelope(envelope({ result: '{"title":"x"}' })), { text: '{"title":"x"}', error: null });
  assert.match(parseClaudeEnvelope(JSON.stringify({ is_error: true, result: 'usage limit reached' })).error, /usage limit/);
  assert.match(parseClaudeEnvelope(envelope({ result: 'x', permission_denials: [{ tool_name: 'Read' }] })).error, /denied permission/);
  // A shape change in the envelope should degrade to the raw text, not to a hard failure.
  assert.deepEqual(parseClaudeEnvelope('plain text reply'), { text: 'plain text reply', error: null });
  assert.equal(parseClaudeEnvelope('').error, 'no output');
});

test('status reads the CLI auth JSON and separates a plan from a billed key', async () => {
  const statusWith = (stdout) => claudeStatus({
    binPath: '/opt/tools/claude',
    isExecutable: async () => true,
    run: async ({ args }) => {
      assert.deepEqual(args, ['auth', 'status']);
      return { code: 0, stdout, stderr: '', timedOut: false };
    },
  });

  const plan = await statusWith(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max', email: 'maker@example.com' }));
  assert.deepEqual(
    { available: plan.available, signedIn: plan.signedIn, method: plan.method, plan: plan.plan, account: plan.account },
    { available: true, signedIn: true, method: 'subscription', plan: 'max', account: 'maker@example.com' },
  );
  assert.deepEqual(plan.models, CLAUDE_MODELS);

  const billed = await statusWith(JSON.stringify({ loggedIn: true, authMethod: 'apiKey' }));
  assert.equal(billed.method, 'api-key');

  const signedOut = await statusWith(JSON.stringify({ loggedIn: false }));
  assert.equal(signedOut.available, true);
  assert.equal(signedOut.signedIn, false);
  assert.deepEqual(signedOut.models, []);
});

test('a missing CLI, unreadable status and a timeout are all reported, never thrown', async () => {
  assert.deepEqual(
    await claudeStatus({ isExecutable: async () => false, env: { PATH: '/usr/bin' }, home: '/Users/maker' }),
    { available: false, signedIn: false, binPath: null, error: 'Claude Code CLI not found' },
  );

  const garbled = await claudeStatus({
    binPath: '/opt/tools/claude', isExecutable: async () => true,
    run: async () => ({ code: 1, stdout: 'not json', stderr: 'boom', timedOut: false }),
  });
  assert.equal(garbled.signedIn, false);
  assert.match(garbled.error, /boom/);

  const slow = await claudeStatus({
    binPath: '/opt/tools/claude', isExecutable: async () => true,
    run: async () => ({ code: null, stdout: '', stderr: '', timedOut: true }),
  });
  assert.match(slow.error, /timed out/);
});

test('the CLI is found in the Claude Code install location as well as the usual bins', async () => {
  const present = new Set(['/Users/maker/.claude/local/claude']);
  const status = await claudeStatus({
    env: { PATH: '/usr/bin' }, home: '/Users/maker',
    isExecutable: async (file) => present.has(file),
    run: async () => ({ code: 0, stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai' }), stderr: '', timedOut: false }),
  });
  assert.equal(status.binPath, '/Users/maker/.claude/local/claude');
});

test('a successful run writes the photos beside the prompt and cleans up after itself', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'claude-listing-test-'));
  const listing = '{"title":"Desk Dragon","tags":["dragon"]}';
  const seen = {};
  const run = async (opts) => {
    seen.bin = opts.bin; seen.stdin = opts.stdin; seen.cwd = opts.cwd; seen.env = opts.env;
    seen.files = fs.readdirSync(opts.cwd);
    return { code: 0, stdout: envelope({ result: listing }), stderr: '', timedOut: false };
  };

  const result = await generateClaudeListing(
    {
      prompt: 'Write the listing.',
      model: 'opus',
      binPath: '/opt/tools/claude',
      images: [
        { base64: PNG_BASE64, mediaType: 'image/png' },
        { base64: PNG_BASE64, mediaType: 'application/pdf' }, // unsupported ⇒ dropped
      ],
    },
    { tmpdir, run, isExecutable: async (f) => f === '/opt/tools/claude' },
  );

  assert.equal(result.text, listing);
  assert.equal(seen.bin, '/opt/tools/claude');
  assert.deepEqual(seen.files, ['photo-1.png']);
  assert.match(seen.stdin, /- photo-1\.png/);
  // The CLI must run inside the temp directory, which is the only place it can read from.
  assert.equal(seen.cwd.startsWith(tmpdir), true);
  assert.deepEqual(await fsp.readdir(tmpdir), []);
  await fsp.rm(tmpdir, { recursive: true, force: true });
});

test('missing CLI, empty prompt and unusable photos fail before anything is spawned', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'claude-listing-test-'));
  let spawned = 0;
  const run = async () => { spawned += 1; return { code: 0, stdout: envelope({ result: '{}' }), stderr: '', timedOut: false }; };
  const images = [{ base64: PNG_BASE64, mediaType: 'image/png' }];

  await assert.rejects(generateClaudeListing({ prompt: ' ', images }, { tmpdir, run, isExecutable: async () => true }), /no prompt supplied/);
  await assert.rejects(generateClaudeListing({ prompt: 'p', images }, { tmpdir, run, isExecutable: async () => false }), /Claude Code CLI not found/);
  await assert.rejects(
    generateClaudeListing({ prompt: 'p', images: [{ base64: PNG_BASE64, mediaType: 'image/tiff' }] }, { tmpdir, run, isExecutable: async () => true }),
    /no usable images/,
  );
  assert.equal(spawned, 0);
  assert.deepEqual(await fsp.readdir(tmpdir), []);
  await fsp.rm(tmpdir, { recursive: true, force: true });
});

test('a failed run is explained and still cleans up the temp workspace', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'claude-listing-test-'));
  const failWith = (stdout, stderr = '') => generateClaudeListing(
    { prompt: 'p', images: [{ base64: PNG_BASE64, mediaType: 'image/png' }] },
    { tmpdir, run: async () => ({ code: 1, stdout, stderr, timedOut: false }), isExecutable: async () => true },
  );

  await assert.rejects(failWith(JSON.stringify({ is_error: true, result: 'Invalid API key · Please run /login' })), /signed in|login/i);
  await assert.rejects(failWith(JSON.stringify({ is_error: true, result: 'Claude usage limit reached' })), /usage limit/i);
  await assert.rejects(
    generateClaudeListing(
      { prompt: 'p', images: [{ base64: PNG_BASE64, mediaType: 'image/png' }] },
      { tmpdir, run: async () => ({ code: null, stdout: '', stderr: '', timedOut: true }), isExecutable: async () => true },
    ),
    /timed out/,
  );
  assert.deepEqual(await fsp.readdir(tmpdir), []);
  await fsp.rm(tmpdir, { recursive: true, force: true });
});

test('failure messages name the fix rather than echoing CLI noise', () => {
  assert.match(claudeFailureMessage({ detail: 'not logged in' }), /claude auth login/);
  assert.match(claudeFailureMessage({ detail: 'usage limit reached for this 5-hour window' }), /usage limit/);
  assert.match(claudeFailureMessage({ code: 7, stderr: '', stdout: '' }), /exited 7/);
});
