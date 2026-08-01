import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDraftPayload, buildLaserCutPayload, mwDraftStatus, mwLaserCutDraftStatus, mwLogin, mwLoginWithCode, mwPresignUpload, mwRefreshToken,
  mwUploadCapabilities, parseMakerWorldUploadCapabilities,
} from './makerworld-web.ts';

test('MakerWorld login preserves the verification key and sends it with the email code', async () => {
  const previousFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    if (bodies.length === 1) {
      return new Response(JSON.stringify({ loginType: 'verifyCode', tfaKey: 'challenge-key' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ accessToken: 'access', userId: 'user', expireIn: 60 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    assert.deepEqual(await mwLogin('person@example.com', 'password'), {
      ok: false, needCode: true, tfaKey: 'challenge-key',
    });
    assert.deepEqual(await mwLoginWithCode('person@example.com', '123456', 'challenge-key'), {
      ok: true, token: 'access', userId: 'user', expireIn: 60, refreshToken: undefined,
    });
    assert.deepEqual(bodies[1], { account: 'person@example.com', code: '123456', tfaKey: 'challenge-key' });
  } finally { globalThis.fetch = previousFetch; }
});

test('MakerWorld login surfaces CAPTCHA as a desktop-window fallback', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 403, error: 'GeeTest captcha required' }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
  try {
    await assert.rejects(
      mwLogin('person@example.com', 'password'),
      /CAPTCHA.*MakerWorld window/i,
    );
  } finally { globalThis.fetch = previousFetch; }
});

test('regular payload preserves raw-file, profile, compatibility, BOM, and CyberBrick settings', () => {
  const payload = buildDraftPayload({
    title: 'Organizer', description: '<p>Useful.</p>', categoryId: 401,
    coverUrl: 'https://cdn/cover.jpg', coverPortraitUrl: 'https://cdn/portrait.jpg',
    visibility: 'public', model3mf: { name: 'print.3mf', size: 10, url: 'https://cdn/print.3mf' },
    modelFiles: [{
      modelName: 'source.step', modelSize: 20, modelType: 'step', modelUrl: 'https://cdn/source.step',
      note: 'Parametric source', protected: true, relativePath: 'CAD/source.step',
      cdnPrefix: 'https://cdn', uploadKey: 'models/source.step',
    }],
    printProfile: {
      title: '0.2mm', description: '<p>Fast.</p>', pictureUrls: ['https://cdn/real.jpg'],
      visibility: 'private', realPhotoConfirmed: true, isPrinterTested: true,
      otherCompatibility: [{ dev_setting_name: '', dev_model_name: 'C12', dev_product_name: 'P1S', nozzle_diameter: 0.4 }],
    },
    boms: { otherParts: [{ name: 'M3 screw', quantity: 4 }, { name: '  ', quantity: 1 }] },
    cyberBrick: { controlConfig: [{ uniKey: 'control', name: 'control.json', size: 5, url: 'https://cdn/control.json' }] },
    designVideo: [{ name: 'turntable.mov', url: 'https://cdn/turntable.mov' }],
  }, 'publish');

  assert.equal(payload.modelFiles[0].file.path, 'CAD/source.step');
  assert.equal(payload.modelFiles[0].note, 'Parametric source');
  assert.equal(payload.modelFiles[0].protected, true);
  assert.equal(payload.designSetting.submitAsPrivate, false);
  assert.equal(payload.instanceSetting.submitAsPrivate, true);
  assert.equal(payload.profileSummary, '<p>Fast.</p>');
  assert.equal(payload.auxiliaryPictures[0].isRealLifePhoto, 1);
  assert.deepEqual(payload.otherCompatibility[0], { devModelName: 'C12', devProductName: 'P1S', nozzleDiameter: 0.4 });
  assert.equal(payload.bomsNeeded, true);
  assert.deepEqual(payload.bomsOfOtherPartList, [{ name: 'M3 screw', quantity: 4 }]);
  assert.equal(payload.cyberBrick.cyberBrickNeeded, true);
  assert.deepEqual(payload.designVideo, [{ name: 'turntable.mov', url: 'https://cdn/turntable.mov' }]);
});

test('Laser & Cut .lac payload keeps the package separate from raw files and sends profile metadata', () => {
  const payload = buildLaserCutPayload({
    title: 'Laser box', visibility: 'private',
    modelFiles: [{ modelName: 'source.lac', modelSize: 20, modelType: 'lac', modelUrl: 'https://cdn/source.lac' }],
    lacFile: { uniKey: 'lac-key', name: 'box.lac', size: 100, url: 'https://cdn/box.lac' },
    lacInfo: { plates: [{ id: 1 }], processTypes: ['cut'], machineName: 'H2D', materialIds: ['plywood'] },
    lacCustomInfo: { otherTools: 'clamps', compatibleDevicesSelected: ['H2D'] },
    profileTitle: '3mm plywood', profileDescription: '<p>Cut profile.</p>', profileVisibility: 'public',
    profilePictures: ['https://cdn/real.jpg'],
    cyberBrick: { controlConfig: [{ name: 'control.json', size: 5, url: 'https://cdn/control.json' }] },
    resolvedOriginals: [{ link: 'https://example.com/source', designId: 0, designType: 1, license: 'BY' }],
    remixDescription: 'Resized tabs.', modelSource: 'remix',
  }, 'publish');

  assert.equal(payload.draft.design.modelFiles[0].modelName, 'source.lac');
  assert.equal(payload.draft.instance.lacFile.name, 'box.lac');
  assert.equal(payload.draft.instance.lacInfo.machineName, 'H2D');
  assert.equal(payload.draft.instance.title, '3mm plywood');
  assert.equal(payload.draft.instance.submitAsPrivate, false);
  assert.deepEqual(payload.draft.instance.pictures, [{ url: 'https://cdn/real.jpg' }]);
  assert.equal(payload.draft.extra.draftSetting.createWithLac, true);
  assert.equal(payload.draft.design.original[0].link, 'https://example.com/source');
  assert.equal(payload.draft.design.original[0].designType, 1);
  assert.equal(payload.draft.design.cyberBrick.cyberBrickNeeded, true);
});

test('raw Laser & Cut payload carries source-file folder, note, and open-source protection', () => {
  const payload = buildLaserCutPayload({
    title: 'Panel', pictures: ['https://cdn/cover.jpg'],
    modelFiles: [{
      modelName: 'panel.svg', modelSize: 30, modelType: 'svg', modelUrl: 'https://cdn/panel.svg',
      relativePath: 'vectors/panel.svg', note: 'Cut line', protected: false, cdnPrefix: 'https://cdn', uploadKey: 'panel.svg',
    }],
  }, 'next');
  assert.equal(payload.draft.instance.lacFile.name, '');
  assert.equal(payload.draft.extra.draftSetting.createWithLac, false);
  assert.equal(payload.draft.design.modelFiles[0].file.path, 'vectors/panel.svg');
  assert.equal(payload.draft.design.modelFiles[0].note, 'Cut line');
  assert.equal(payload.draft.design.modelFiles[0].protected, false);
});

test('presign returns the direct S3 URL and public MakerWorld CDN reference', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    cdnPrefix: 'https://makerworld.bblmw.com',
    urls: ['https://bucket.example/makerworld/model/2026/file.step?signature=x'],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const result = await mwPresignUpload({ cookie: 'token=test' }, 'file.step');
    assert.equal(result.key, 'makerworld/model/2026/file.step');
    assert.equal(result.url, 'https://makerworld.bblmw.com/makerworld/model/2026/file.step');
    assert.match(result.signedUrl, /signature=x/);
  } finally { globalThis.fetch = previousFetch; }
});

test('Laser & Cut draft status exposes MakerWorld rejection details', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ resultType: 42, resultDesc: 'Invalid laser profile', title: 'Box' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
  try {
    assert.deepEqual(await mwLaserCutDraftStatus({ cookie: 'token=test' }, 123), {
      outcome: 'failed', code: 42, reason: 'Invalid laser profile', plate: undefined, title: 'Box', profileTitle: undefined,
      status: undefined, designId: undefined, profileId: undefined,
    });
  } finally { globalThis.fetch = previousFetch; }
});

test('regular draft status exposes the published design and profile ids', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    resultType: 0,
    status: 1,
    designId: 3104770,
    profileId: 3500162,
    title: 'Articulating Desk Dragon — Print-in-Place',
    profileTitle: 'desk-dragon-bambu',
    designVideo: [{ name: 'turntable.mov', url: 'https://cdn/turntable.mov' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    assert.deepEqual(await mwDraftStatus({ cookie: 'token=test' }, 9000902), {
      outcome: 'live',
      code: 0,
      reason: '',
      plate: undefined,
      title: 'Articulating Desk Dragon — Print-in-Place',
      profileTitle: 'desk-dragon-bambu',
      status: 1,
      designId: 3104770,
      profileId: 3500162,
      designVideo: [{ name: 'turntable.mov', url: 'https://cdn/turntable.mov' }],
    });
  } finally { globalThis.fetch = previousFetch; }
});

test('token refresh normalizes accessToken and rotated refresh cookie', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ accessToken: 'new-token', expireIn: 3600 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'refreshToken=new-refresh; Path=/; HttpOnly' },
  });
  try {
    assert.deepEqual(await mwRefreshToken({ cookie: 'token=old; refreshToken=old-refresh' }), {
      token: 'new-token', refreshToken: 'new-refresh', expiresIn: 3600,
    });
  } finally { globalThis.fetch = previousFetch; }
});

test('publish-page metadata exposes account CyberBrick and upload eligibility', () => {
  const html = '<html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({
    props: { pageProps: { userInfo: {
      rcUpload: false, defaultLicense: 'BY', bannedPermission: { upload: false },
    } } },
  }) + '</script></html>';
  assert.deepEqual(parseMakerWorldUploadCapabilities(html), {
    rcUpload: false, uploadAllowed: true, defaultLicense: 'BY',
  });
});

test('upload capabilities prefer the token-compatible JSON profile service', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ rcUpload: true, bannedPermission: { upload: false } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    assert.deepEqual(await mwUploadCapabilities({ cookie: 'token=test' }), { rcUpload: true, uploadAllowed: true });
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previousFetch; }
});
