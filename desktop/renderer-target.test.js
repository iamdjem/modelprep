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

// Windows drops every toast unless the process declares the same AppUserModelID
// the installer registered. It is one line in main.js and invisible when wrong,
// so it is pinned here rather than discovered by a Windows tester.
test('main declares an AppUserModelID so Windows notifications appear', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.match(main, /setAppUserModelId\(['"]io\.makerstats\.modelprep['"]\)/);
  const appId = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).build.appId;
  assert.equal(appId, 'io.makerstats.modelprep', 'the declared id must match the installer appId');
});

test('packaged previews use software WebGL without exposing it to remote platform pages', () => {
  const fs = require('node:fs');
  const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

  assert.match(main, /appendSwitch\(['"]enable-unsafe-swiftshader['"]\)/);
  assert.match(main, /app\.disableHardwareAcceleration\(\)/);
  assert.match(main, /function remotePagePreferences[\s\S]*webgl:\s*false/);
  assert.match(main, /function createMainWindow[\s\S]*preload:[\s\S]*contextIsolation:\s*true[\s\S]*nodeIntegration:\s*false/);
  assert.doesNotMatch(
    main.match(/function createMainWindow[\s\S]*?return win;/)?.[0] || '',
    /webgl:\s*false/,
    'the trusted bundled renderer must retain software WebGL access',
  );
});
