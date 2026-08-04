const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  CODEX_LISTING_SCHEMA,
  buildCodexArgs,
  codexEnv,
  codexFailureMessage,
  codexStatus,
  findCodexBinary,
  generateCodexListing,
  listCodexModels,
  parseCodexModels,
} = require('./codex-listing');

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('packaged desktop allowlist includes the codex listing module', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('codex-listing.js'));
  assert.match(packageJson.scripts.test, /codex-listing\.test\.js/);
});

test('binary lookup prefers the configured path and otherwise scans install locations', async () => {
  const present = new Set(['/custom/codex', '/Users/maker/.local/bin/codex']);
  const isExecutable = async (file) => present.has(file);

  assert.equal(await findCodexBinary({ binPath: '/custom/codex', isExecutable }), '/custom/codex');
  // A configured path that does not exist must not silently fall back to some other codex.
  assert.equal(await findCodexBinary({ binPath: '/gone/codex', isExecutable }), null);
  // Finder-launched apps inherit a bare PATH; the well-known locations still find it.
  assert.equal(
    await findCodexBinary({ env: { PATH: '/usr/bin:/bin' }, home: '/Users/maker', isExecutable }),
    '/Users/maker/.local/bin/codex',
  );
  assert.equal(await findCodexBinary({ env: { PATH: '/usr/bin' }, home: '/Users/other', isExecutable }), null);
});

test('child env keeps the maker environment and adds the binary directory to PATH', () => {
  const env = codexEnv({ env: { PATH: '/usr/bin', CODEX_HOME: '/Users/maker/.codex' }, home: '/Users/maker', binPath: '/opt/tools/codex' });
  assert.equal(env.CODEX_HOME, '/Users/maker/.codex');
  const dirs = env.PATH.split(path.delimiter);
  assert.equal(dirs[0], '/opt/tools');
  assert.ok(dirs.includes('/usr/bin'));
  assert.ok(dirs.includes('/Users/maker/.local/bin'));
});

test('exec args pin a read-only, config-free, schema-constrained run', () => {
  const args = buildCodexArgs({
    imagePaths: ['/tmp/x/photo-1.jpg', '/tmp/x/photo-2.png'],
    workdir: '/tmp/x/work', schemaPath: '/tmp/x/listing-schema.json', outputPath: '/tmp/x/listing.json',
    model: 'gpt-5.1-codex',
  });
  assert.equal(args[0], 'exec');
  for (const flag of ['--ignore-user-config', '--ephemeral', '--skip-git-repo-check']) assert.ok(args.includes(flag), `missing ${flag}`);
  assert.equal(args[args.indexOf('-s') + 1], 'read-only');
  assert.equal(args[args.indexOf('-m') + 1], 'gpt-5.1-codex');
  assert.equal(args[args.indexOf('--output-schema') + 1], '/tmp/x/listing-schema.json');
  assert.equal(args[args.indexOf('-o') + 1], '/tmp/x/listing.json');
  // Each image gets its own -i, and the trailing `-` closes the variadic list so no photo
  // path can be swallowed as the prompt.
  assert.deepEqual(args.filter((a, i) => args[i - 1] === '-i'), ['/tmp/x/photo-1.jpg', '/tmp/x/photo-2.png']);
  assert.equal(args[args.length - 1], '-');
  // No model configured ⇒ let the CLI pick its own default rather than guessing one.
  assert.ok(!buildCodexArgs({ imagePaths: [], workdir: '/w', schemaPath: '/s', outputPath: '/o' }).includes('-m'));
});

test('the output schema matches the listing fields the renderer parses', () => {
  assert.deepEqual(
    CODEX_LISTING_SCHEMA.required,
    ['title', 'description', 'tags', 'category', 'realPhotoDetected', 'notes'],
  );
  assert.equal(CODEX_LISTING_SCHEMA.additionalProperties, false);
});

test('a successful run returns the final message and leaves no temp files behind', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-listing-test-'));
  const listing = '{"title":"Desk Dragon","description":"d","tags":["dragon"],"category":"Art","realPhotoDetected":true,"notes":""}';
  const seen = {};
  const run = async ({ bin, args, stdin, env }) => {
    seen.bin = bin; seen.args = args; seen.stdin = stdin; seen.env = env;
    seen.images = args.filter((a, i) => args[i - 1] === '-i').map((f) => fs.readFileSync(f).length);
    seen.schema = JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema') + 1], 'utf8'));
    fs.writeFileSync(args[args.indexOf('-o') + 1], `${listing}\n`);
    return { code: 0, stdout: '', stderr: '', timedOut: false };
  };

  const result = await generateCodexListing(
    {
      prompt: 'Write the listing.',
      model: 'gpt-5.1-codex',
      binPath: '/opt/tools/codex',
      images: [
        { base64: PNG_BASE64, mediaType: 'image/png' },
        { base64: PNG_BASE64, mediaType: 'application/pdf' }, // unsupported type ⇒ dropped
        { base64: '', mediaType: 'image/jpeg' },              // empty ⇒ dropped
      ],
    },
    { tmpdir, run, isExecutable: async (f) => f === '/opt/tools/codex' },
  );

  assert.equal(result.text, listing);
  assert.equal(seen.bin, '/opt/tools/codex');
  assert.equal(seen.stdin, 'Write the listing.');
  assert.equal(seen.images.length, 1);
  assert.ok(seen.images[0] > 0);
  assert.deepEqual(seen.schema, CODEX_LISTING_SCHEMA);
  assert.deepEqual(await fsp.readdir(tmpdir), []);
  await fsp.rm(tmpdir, { recursive: true, force: true });
});

test('the temp workspace is removed even when the run fails', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-listing-test-'));
  const run = async () => ({ code: 1, stdout: '', stderr: 'ERROR: {"type":"error","error":{"message":"model not supported"}}', timedOut: false });
  await assert.rejects(
    generateCodexListing(
      { prompt: 'p', images: [{ base64: PNG_BASE64, mediaType: 'image/png' }] },
      { tmpdir, run, isExecutable: async () => true, env: { PATH: '/usr/bin' }, home: '/Users/maker' },
    ),
    /model not supported/,
  );
  assert.deepEqual(await fsp.readdir(tmpdir), []);
  await fsp.rm(tmpdir, { recursive: true, force: true });
});

test('missing CLI, empty prompt and unusable photos fail before anything is spawned', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-listing-test-'));
  let spawned = 0;
  const run = async () => { spawned += 1; return { code: 0, stdout: '', stderr: '', timedOut: false }; };
  const images = [{ base64: PNG_BASE64, mediaType: 'image/png' }];

  await assert.rejects(
    generateCodexListing({ prompt: '  ', images }, { tmpdir, run, isExecutable: async () => true }),
    /no prompt supplied/,
  );
  await assert.rejects(
    generateCodexListing({ prompt: 'p', images }, { tmpdir, run, isExecutable: async () => false }),
    /codex CLI not found/,
  );
  await assert.rejects(
    generateCodexListing({ prompt: 'p', images: [{ base64: PNG_BASE64, mediaType: 'image/tiff' }] }, { tmpdir, run, isExecutable: async () => true }),
    /no usable images/,
  );
  assert.equal(spawned, 0);
  assert.deepEqual(await fsp.readdir(tmpdir), []);
  await fsp.rm(tmpdir, { recursive: true, force: true });
});

test('a timed-out run is reported as a timeout, not as empty output', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'codex-listing-test-'));
  const run = async () => ({ code: null, stdout: '', stderr: '', timedOut: true });
  await assert.rejects(
    generateCodexListing({ prompt: 'p', images: [{ base64: PNG_BASE64, mediaType: 'image/png' }] }, { tmpdir, run, isExecutable: async () => true }),
    /timed out/,
  );
  await fsp.rm(tmpdir, { recursive: true, force: true });
});

test('status distinguishes missing CLI, signed-out, ChatGPT plan and API key', async () => {
  assert.deepEqual(
    await codexStatus({ isExecutable: async () => false, env: { PATH: '/usr/bin' }, home: '/Users/maker' }),
    { available: false, signedIn: false, binPath: null, error: 'codex CLI not found' },
  );

  const statusWith = (stdout, code = 0) => codexStatus({
    binPath: '/opt/tools/codex',
    isExecutable: async () => true,
    run: async ({ args }) => {
      assert.deepEqual(args, ['login', 'status']);
      return { code, stdout, stderr: '', timedOut: false };
    },
  });

  const chatgpt = await statusWith('Logged in using ChatGPT\n');
  assert.deepEqual(
    { available: chatgpt.available, signedIn: chatgpt.signedIn, method: chatgpt.method, binPath: chatgpt.binPath },
    { available: true, signedIn: true, method: 'chatgpt', binPath: '/opt/tools/codex' },
  );

  const apiKey = await statusWith('Logged in using an API key\n');
  assert.equal(apiKey.method, 'api-key');
  assert.equal(apiKey.signedIn, true);

  const signedOut = await statusWith('Not logged in\n', 1);
  assert.equal(signedOut.available, true);
  assert.equal(signedOut.signedIn, false);
  assert.match(signedOut.error, /Not logged in/);
});

test('the model catalog lists only vision-capable models, best first', () => {
  const catalog = JSON.stringify({
    models: [
      { slug: 'codex-auto-review', display_name: 'Codex Auto Review', visibility: 'hide', priority: 3, input_modalities: ['text', 'image'] },
      { slug: 'gpt-5.4', display_name: 'GPT-5.4', visibility: 'list', priority: 16, input_modalities: ['text', 'image'] },
      { slug: 'spark', display_name: 'Spark', visibility: 'list', priority: 26, input_modalities: ['text'] },
      { slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list', priority: 7, input_modalities: ['text', 'image'] },
    ],
  });
  // Internal entries and text-only models are dropped — every listing here starts from photos.
  assert.deepEqual(parseCodexModels(catalog), [
    { slug: 'gpt-5.5', label: 'GPT-5.5' },
    { slug: 'gpt-5.4', label: 'GPT-5.4' },
  ]);
  assert.deepEqual(parseCodexModels('not json'), []);
  assert.deepEqual(parseCodexModels('{}'), []);
});

test('listing models survives a missing CLI, a crash and a timeout without throwing', async () => {
  assert.deepEqual(
    await listCodexModels({ isExecutable: async () => false, env: { PATH: '/usr/bin' }, home: '/Users/maker' }),
    { models: [], error: 'codex CLI not found' },
  );

  const crashed = await listCodexModels({
    binPath: '/opt/tools/codex', isExecutable: async () => true,
    run: async () => { throw new Error('spawn EACCES'); },
  });
  assert.deepEqual(crashed.models, []);
  assert.match(crashed.error, /EACCES/);

  const slow = await listCodexModels({
    binPath: '/opt/tools/codex', isExecutable: async () => true,
    run: async () => ({ code: null, stdout: '', stderr: '', timedOut: true }),
  });
  assert.deepEqual(slow.models, []);
  assert.match(slow.error, /timed out/);
});

test('the catalog run asks for JSON and raises the output cap above the default', async () => {
  const seen = {};
  const models = JSON.stringify({ models: [{ slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list', priority: 7, input_modalities: ['text', 'image'] }] });
  const result = await listCodexModels({
    binPath: '/opt/tools/codex',
    isExecutable: async () => true,
    run: async (opts) => { Object.assign(seen, opts); return { code: 0, stdout: models, stderr: '', timedOut: false }; },
  });
  assert.deepEqual(seen.args, ['debug', 'models']);
  // The real catalog is ~180 KB; the 20 KB default capture would clip it into invalid JSON.
  assert.ok(seen.maxOutputChars > 200_000);
  assert.deepEqual(result.models, [{ slug: 'gpt-5.5', label: 'GPT-5.5' }]);
});

test('failure messages surface the actionable cause', () => {
  assert.match(
    codexFailureMessage({ code: 1, stderr: 'ERROR: {"type":"error","status":400,"error":{"message":"The \'gpt-5.1\' model is not supported when using Codex with a ChatGPT account."}}' }),
    /not supported when using Codex with a ChatGPT account/,
  );
  assert.match(codexFailureMessage({ code: 1, stderr: 'Not logged in. Please run codex login.' }), /codex login/);
  assert.match(codexFailureMessage({ code: 7, stderr: '', stdout: '' }), /exited 7/);
});
