const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { childEnv, findBinary, searchDirs, withTempDir, writeImages } = require('./cli-process');

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('the binary search covers install locations a Finder-launched app never sees on PATH', () => {
  const dirs = searchDirs({ env: { PATH: '/usr/bin:/bin' }, home: '/Users/maker' });
  for (const dir of ['/usr/bin', '/Users/maker/.local/bin', '/opt/homebrew/bin', '/usr/local/bin']) {
    assert.ok(dirs.includes(dir), `missing ${dir}`);
  }
  // Agent-specific locations are appended, with `~` resolved against the maker's home.
  assert.ok(searchDirs({ env: { PATH: '' }, home: '/Users/maker', extraDirs: ['~/.claude/local'] }).includes('/Users/maker/.claude/local'));
});

test('an explicit binary path wins, and a wrong one fails rather than falling back', async () => {
  const present = new Set(['/custom/tool', '/Users/maker/.local/bin/tool']);
  const isExecutable = async (file) => present.has(file);
  assert.equal(await findBinary({ name: 'tool', binPath: '/custom/tool', isExecutable }), '/custom/tool');
  assert.equal(await findBinary({ name: 'tool', binPath: '/gone/tool', isExecutable }), null);
  assert.equal(await findBinary({ name: 'tool', env: { PATH: '/usr/bin' }, home: '/Users/maker', isExecutable }), '/Users/maker/.local/bin/tool');
});

test('child env keeps the maker environment and puts the binary directory first', () => {
  const env = childEnv({ env: { PATH: '/usr/bin', CODEX_HOME: '/Users/maker/.codex' }, home: '/Users/maker', binPath: '/opt/tools/codex' });
  assert.equal(env.CODEX_HOME, '/Users/maker/.codex');
  assert.equal(env.PATH.split(path.delimiter)[0], '/opt/tools');
});

test('images are decoded to disk, capped, and unsupported types dropped', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cli-process-test-'));
  const files = await writeImages({
    fs: fsp,
    dir,
    images: [
      { base64: PNG_BASE64, mediaType: 'image/png' },
      { base64: PNG_BASE64, mediaType: 'image/tiff' },   // unsupported
      { base64: '', mediaType: 'image/jpeg' },           // empty
      ...Array.from({ length: 12 }, () => ({ base64: PNG_BASE64, mediaType: 'image/jpeg' })),
    ],
  });
  // Eight is the cap; the dropped entries do not consume a slot silently in the middle.
  assert.equal(files.length, 6);
  assert.deepEqual((await fsp.readdir(dir)).sort(), ['photo-1.png', 'photo-4.jpg', 'photo-5.jpg', 'photo-6.jpg', 'photo-7.jpg', 'photo-8.jpg']);
  await fsp.rm(dir, { recursive: true, force: true });
});

test('the temp workspace is removed whether the body succeeds or throws', async () => {
  const tmpdir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cli-process-test-'));

  const value = await withTempDir({ fs: fsp, tmpdir }, async (dir) => {
    await fsp.writeFile(path.join(dir, 'scratch.txt'), 'x');
    return 'done';
  });
  assert.equal(value, 'done');
  assert.deepEqual(await fsp.readdir(tmpdir), []);

  await assert.rejects(withTempDir({ fs: fsp, tmpdir }, async () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(await fsp.readdir(tmpdir), []);
  await fsp.rm(tmpdir, { recursive: true, force: true });
});
