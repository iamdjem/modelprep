const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  DEFAULT_REMOTE_URL,
  resolveRendererTarget,
  isRendererNavigation,
} = require('./renderer-target');

test('packaged ModelPrep uses the renderer shipped inside the same app bundle', () => {
  const target = resolveRendererTarget({
    isPackaged: true,
    resourcesPath: '/Applications/ModelPrep.app/Contents/Resources',
  });
  assert.deepEqual(target, {
    kind: 'file',
    value: path.join('/Applications/ModelPrep.app/Contents/Resources', 'renderer', 'index.html'),
  });
  assert.equal(isRendererNavigation(pathToFileURL(target.value).href, target), true);
  assert.equal(isRendererNavigation('https://makeronline.com/en/upload', target), false);
});

test('explicit local preview wins while unpackaged development retains the hosted fallback', () => {
  assert.deepEqual(resolveRendererTarget({
    overrideUrl: 'http://localhost:4173',
    isPackaged: true,
    resourcesPath: '/tmp/resources',
  }), { kind: 'url', value: 'http://localhost:4173' });
  assert.deepEqual(resolveRendererTarget(), { kind: 'url', value: DEFAULT_REMOTE_URL });
});
