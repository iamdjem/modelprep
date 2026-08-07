const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  GEMINI_MODELS,
  buildGeminiArgs,
  buildGeminiPrompt,
  generateGeminiListing,
  geminiFailureMessage,
  geminiStatus,
} = require('./gemini-listing');

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// A binary that is always "found", so tests exercise the adapter and not PATH lookup.
const found = { isExecutable: async () => true, env: { PATH: '/usr/bin' }, home: '/home/maker' };
const ok = (stdout) => async () => ({ code: 0, stdout, stderr: '', timedOut: false });

test('packaged desktop allowlist includes the Gemini module and its shared plumbing', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('gemini-listing.js'));
  assert.ok(packageJson.build.files.includes('cli-process.js'));
  assert.match(packageJson.scripts.test, /gemini-listing\.test\.js/);
});

test('runs one non-interactive turn, and only pins a model when one is chosen', () => {
  const args = buildGeminiArgs({ model: 'gemini-2.5-flash' });
  assert.ok(args.includes('-p'));
  assert.equal(args[args.indexOf('--model') + 1], 'gemini-2.5-flash');
  // No model configured ⇒ let the CLI pick, rather than pinning one the account may not have.
  assert.ok(!buildGeminiArgs({}).includes('--model'));
});

test('the prompt names the photos by basename so the CLI can read them locally', () => {
  const prompt = buildGeminiPrompt({ prompt: 'Write a listing.', imagePaths: ['/tmp/x/photo-1.png', '/tmp/x/photo-2.png'] });
  assert.match(prompt, /- photo-1\.png/);
  assert.match(prompt, /- photo-2\.png/);
  assert.ok(!prompt.includes('/tmp/x'), 'absolute paths would not resolve from the working directory');
  assert.match(prompt, /JSON object only/);
});

test('reports a missing CLI rather than pretending it is merely signed out', async () => {
  const status = await geminiStatus({ isExecutable: async () => false, env: { PATH: '/usr/bin' }, home: '/home/maker' });
  assert.equal(status.available, false);
  assert.equal(status.signedIn, false);
  assert.match(status.error, /not found/i);
});

test('treats a working probe as signed in and offers the model list', async () => {
  const status = await geminiStatus({ ...found, run: ok('ok') });
  assert.equal(status.available, true);
  assert.equal(status.signedIn, true);
  assert.deepEqual(status.models, GEMINI_MODELS);
  assert.equal(status.error, null);
});

test('separates an installed-but-signed-out CLI from a missing one', async () => {
  const status = await geminiStatus({
    ...found,
    run: async () => ({ code: 1, stdout: '', stderr: 'Please sign in to continue', timedOut: false }),
  });
  assert.equal(status.available, true, 'the binary exists');
  assert.equal(status.signedIn, false);
  assert.deepEqual(status.models, []);
});

test('a hung probe never leaves the panel spinning', async () => {
  const status = await geminiStatus({ ...found, run: async () => ({ code: null, stdout: '', stderr: '', timedOut: true }) });
  assert.equal(status.signedIn, false);
  assert.match(status.error, /timed out/i);
});

test('distinguishes a metered key from a plan, since only one bills per listing', async () => {
  const keyed = await geminiStatus({ ...found, env: { PATH: '/usr/bin', GEMINI_API_KEY: 'x' }, run: ok('ok') });
  assert.equal(keyed.method, 'api-key');
  const plan = await geminiStatus({ ...found, run: ok('ok') });
  assert.equal(plan.method, 'subscription');
});

test('returns the reply text for the shared listing parser', async () => {
  const result = await generateGeminiListing(
    { prompt: 'Write a listing.', images: [{ base64: PNG_BASE64, mediaType: 'image/png' }] },
    { ...found, run: ok('{"title":"Desk Dragon"}') },
  );
  assert.match(result.text, /Desk Dragon/);
});

test('refuses to run without a prompt or without usable photos', async () => {
  await assert.rejects(
    generateGeminiListing({ prompt: '', images: [{ base64: PNG_BASE64, mediaType: 'image/png' }] }, { ...found, run: ok('x') }),
    /no prompt/i,
  );
  await assert.rejects(
    generateGeminiListing({ prompt: 'Write a listing.', images: [] }, { ...found, run: ok('x') }),
    /no usable images/i,
  );
});

test('a successful exit with no output is still a failure, not an empty listing', async () => {
  await assert.rejects(
    generateGeminiListing(
      { prompt: 'Write a listing.', images: [{ base64: PNG_BASE64, mediaType: 'image/png' }] },
      { ...found, run: ok('   ') },
    ),
    /gemini/i,
  );
});

test('turns the common failures into something a maker can act on', () => {
  assert.match(
    geminiFailureMessage({ stderr: 'Error: not authenticated' }),
    /run `gemini` once and sign in/i,
  );
  assert.match(geminiFailureMessage({ stderr: 'RESOURCE_EXHAUSTED: quota' }), /quota/i);
  assert.match(geminiFailureMessage({ code: 127, stderr: '' }), /exited 127/);
});
