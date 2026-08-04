const assert = require('node:assert/strict');
const test = require('node:test');
const { createMyMiniFactoryDirectClient, parseUploadPage, validateFile, validateSubmit } = require('./myminifactory-direct');

const context = { cookie: 'session=test' };
const uploadHtml = `
  <img alt="User avatar" title="iamdjem">
  <input name="uniqFolderName" value="folder-1">
  <input name="threedobject_temp_type[_token]" value="csrf-1">
`;

test('MyMiniFactory upload page parser keeps identity and CSRF context in main', () => {
  assert.deepEqual(parseUploadPage(uploadHtml), { folder: 'folder-1', csrfToken: 'csrf-1', username: 'iamdjem' });
});

test('MyMiniFactory validation enforces captured file families, category, and legal declaration', () => {
  assert.throws(() => validateFile({ name: 'cover.webp', bytes: Buffer.alloc(1) }, 'image'), /does not accept/i);
  assert.throws(() => validateFile({ name: 'part.exe', bytes: Buffer.alloc(1) }, 'file'), /does not accept/i);
  const issues = validateSubmit({ publication: 'private', title: 'Test', images: [{}], files: [{ uuid: '1' }], licenseId: 5, tags: [] }).join(' ');
  assert.match(issues, /category/i);
  assert.match(issues, /original\/no-generative-AI/i);
  const overlong = validateSubmit({ publication: 'private', title: 'Test', images: [{}], files: [{ uuid: '1' }], licenseId: 5, tags: [], categoryIds: [60], confirmOriginalNoAi: true, dimensions: 'x'.repeat(101), materialQuantity: 'x'.repeat(46), technology: 'SLS', dimensionsUnit: 2 }).join(' ');
  assert.match(overlong, /dimensions must be at most 100/i);
  assert.match(overlong, /material quantity must be at most 45/i);
});

test('MyMiniFactory prepare, uploads, private submit, and read-back use the captured contract', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/upload/object') && (!options.method || options.method === 'GET')) return new Response(uploadHtml, { status: 200 });
    if (String(url).endsWith('/upload/files-upload')) return new Response(JSON.stringify([{ name: 'cover.jpg', url: 'https://cdn/cover.jpg', token: 'i1', size: 10, deleteUrls: [] }]), { status: 200 });
    if (String(url).endsWith('/upload/presigned-url')) return new Response(JSON.stringify({ presignedUrl: 'https://storage/file', uploadedFileUuid: 'pending-1' }), { status: 200 });
    if (String(url) === 'https://storage/file') return new Response('', { status: 200 });
    if (String(url).endsWith('/upload/presigned-url/complete')) return new Response(JSON.stringify({ uuid: 'file-1', filename: 'part.stl' }), { status: 200 });
    if (String(url).endsWith('/upload/object') && options.method === 'POST') return new Response('', { status: 302, headers: { location: '/object/3d-print-private-test-12345' } });
    if (String(url).includes('/object/3d-print-private-test-12345')) return new Response('<meta property="og:title" content="Private test">private object', { status: 200 });
    if (String(url).endsWith('/object/edit/12345')) return new Response(`
      <input value="Private test" name="threedobject_type[name]">
      <select name="threedobject_type[visibility]"><option value="0" selected>Private</option><option value="2">Public</option></select>
      <input name="categories" value="[60,462]">
      <input name="threedobject_type[images][0][fileName]" value="cover.jpg">
      <a href="/download/12345?downloadfile=part.stl">part.stl</a>
      <select name="license_id"><option value="5" selected>BY-NC-SA</option></select>
      <textarea name="threedobject_type[howto]">No supports</textarea>
      <input name="threedobject_type[time_to_do_from]" value="3">
      <input name="threedobject_type[time_to_do_to]" value="5">
      <input name="threedobject_type[dimensions]" value="120 × 75 × 45">
      <select name="threedobject_type[dimensionsUnit]"><option value="0" selected>mm</option></select>
      <select name="threedobject_type[technology]"><option value="FDM" selected>FDM</option></select>
      <input name="threedobject_type[filament_quantity]" value="45 g">
      <input name="threedobject_type[support_free]" value="1">
    `, { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  };
  const client = createMyMiniFactoryDirectClient({ fetchImpl, uuid: () => 'upload-session' });
  const prepared = await client.prepare(context);
  const image = await client.uploadImage(context, prepared.uploadSessionId, { name: 'cover.jpg', mimeType: 'image/jpeg', bytes: Buffer.from('image') });
  const file = await client.uploadFile(context, prepared.uploadSessionId, { name: 'part.stl', mimeType: 'model/stl', bytes: Buffer.from('solid test') });
  const saved = await client.submit(context, {
    uploadSessionId: prepared.uploadSessionId, publication: 'private', title: 'Private test', description: '<p>Test</p>',
    images: [image], files: [file], tags: ['test'], categoryIds: [60, 462], licenseId: 5, confirmOriginalNoAi: true,
  });
  const readback = await client.status(context, saved.url);
  assert.equal(saved.url, 'https://www.myminifactory.com/object/3d-print-private-test-12345');
  assert.equal(readback.title, 'Private test');
  assert.equal(saved.id, '12345');
  assert.equal(readback.visibility, 'private');
  assert.equal(readback.private, true);
  assert.deepEqual(readback.categoryIds, [60, 462]);
  assert.deepEqual(readback.imageNames, ['cover.jpg']);
  assert.deepEqual(readback.fileNames, ['part.stl']);
  assert.equal(readback.printingTips, 'No supports');
  assert.equal(readback.materialQuantity, '45 g');
  assert.equal(readback.supportFree, true);
  const submit = calls.find((call) => call.url.endsWith('/upload/object') && call.options.method === 'POST');
  assert.match(submit.options.body, /threedobject_temp_type%5Bvisibility%5D=0/);
  assert.match(submit.options.body, /threedobject_temp_type%5B_token%5D=csrf-1/);
  assert.match(submit.options.body, /primary_image=cover.jpg/);
  assert.match(submit.options.body, /categories=%5B60%2C462%5D/);
});

test('MyMiniFactory read-back recovers categories from the React payload before hydration', async () => {
  const editHtml = `
    <input name="threedobject_type[name]" value="Private test">
    <select name="threedobject_type[visibility]"><option value="0" selected>Private</option></select>
    <script type="application/json" class="js-react-on-rails-component" data-component-name="UploadCategories">{"selectedCategories":[{"id":60,"name":"Toys"},{"id":462,"name":"Articulated"}]}</script>
    <input name="threedobject_type[images][0][fileName]" value="cover.jpg">
    <a href="/download/123?downloadfile=part.stl">part.stl</a>
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Private test</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-private-test-123');
  assert.deepEqual(readback.categoryIds, [60, 462]);
});

test('MyMiniFactory read-back recovers files from the UploadFilesWrapper payload before hydration', async () => {
  const editHtml = `
    <input name="threedobject_type[name]" value="Private test">
    <select name="threedobject_type[visibility]"><option value="0" selected>Private</option></select>
    <input name="categories" value="[60,462]">
    <input name="threedobject_type[images][0][fileName]" value="cover.jpg">
    <script type="application/json" class="js-react-on-rails-component" data-component-name="UploadFilesWrapper">{"objectId":123,"archiveFiles":[],"files":[{"id":3,"filename":"profile.3mf","download_url":"https:\/\/www.myminifactory.com\/download\/123?downloadfile=profile.3mf"},{"id":2,"filename":"part-M.stl"},{"id":1,"filename":"part-S.stl"}]}</script>
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Private test</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-private-test-123');
  assert.deepEqual(readback.fileNames, ['profile.3mf', 'part-M.stl', 'part-S.stl']);
});

test('MyMiniFactory read-back recognizes the current remixed editor control and parent IDs', async () => {
  const editHtml = `
    <input name="threedobject_type[name]" value="Private remix test">
    <select name="threedobject_type[visibility]"><option value="0" selected>Private</option></select>
    <input name="categories" value="[60,462]">
    <input name="remix-checkbox" type="checkbox" checked>
    <input name="threedObjectRemixParents" value="829056,">
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Private remix test</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-private-remix-test-123');
  assert.equal(readback.remix, true);
  assert.deepEqual(readback.remixParentIds, ['829056']);
});

test('MyMiniFactory submits an empty print-time range instead of fabricating one', async () => {
  // The native form leaves "Time to print (in minutes)" empty when unset. The
  // old `|| 50` fallback published "0 - 50 minutes" on every object that never
  // touched the field, and it read back unchanged so nothing caught it.
  let submitted = null;
  const uploadHtml = '<input name="uniqFolderName" value="f1"><input name="threedobject_temp_type[_token]" value="t1"><a href="/user/iamdjem">iamdjem</a>';
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    fetchImpl: async (url, options = {}) => {
      const target = String(url);
      if (target.endsWith('/upload/object') && (!options.method || options.method === 'GET')) return new Response(uploadHtml, { status: 200 });
      if (target.endsWith('/upload/object') && options.method === 'POST') {
        submitted = new URLSearchParams(options.body);
        const done = new Response('ok', { status: 200 });
        Object.defineProperty(done, 'url', { value: 'https://www.myminifactory.com/object/3d-print-empty-time-77' });
        return done;
      }
      return new Response('', { status: 200 });
    },
  });

  const context = { cookie: 'session=ok' };
  const prepared = await client.prepare(context);
  await client.submit(context, {
    uploadSessionId: prepared.uploadSessionId, title: 'Empty time', description: 'd', tags: ['a'],
    publication: 'private', categoryIds: [60], licenseId: 5, confirmOriginalNoAi: true,
    images: [{ name: 'cover.jpg' }], files: [{ uuid: 'u1', name: 'part.stl' }],
    timeFrom: '', timeTo: '',
  });

  assert.equal(submitted.get('threedobject_temp_type[time_to_do_from]'), '');
  assert.equal(submitted.get('threedobject_temp_type[time_to_do_to]'), '');
});

test('MyMiniFactory read-back orders gallery images by the persisted position and reports the cover', async () => {
  // Captured read-only from /object/edit on 2026-08-03: each gallery row renders
  // fileName, uploadedBy and an explicit position, and one primary_image radio
  // per image marks the persisted cover. Here the array index deliberately
  // disagrees with position, which is the case the old index sort got wrong.
  const editHtml = `
    <input name="threedobject_type[name]" value="Ordering fixture">
    <select name="threedobject_type[visibility]"><option value="0" selected="selected">Private</option></select>
    <input name="categories" value="[60]">
    <input name="threedobject_type[images][0][fileName]" value="c.jpg">
    <input name="threedobject_type[images][0][position]" value="2">
    <input name="threedobject_type[images][1][fileName]" value="a.jpg">
    <input name="threedobject_type[images][1][position]" value="0">
    <input name="threedobject_type[images][2][fileName]" value="b.jpg">
    <input name="threedobject_type[images][2][position]" value="1">
    <input type="radio" name="primary_image" value="c.jpg">
    <input type="radio" name="primary_image" value="a.jpg" checked>
    <input type="radio" name="primary_image" value="b.jpg">
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Ordering fixture</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-ordering-123');
  assert.deepEqual(readback.imageNames, ['a.jpg', 'b.jpg', 'c.jpg']);
  assert.equal(readback.imageOrderSource, 'position');
  assert.equal(readback.primaryImage, 'a.jpg');
});

test('MyMiniFactory read-back falls back to the array index when a row omits its position', async () => {
  const editHtml = `
    <input name="threedobject_type[name]" value="Fallback fixture">
    <select name="threedobject_type[visibility]"><option value="0" selected="selected">Private</option></select>
    <input name="categories" value="[60]">
    <input name="threedobject_type[images][0][fileName]" value="first.jpg">
    <input name="threedobject_type[images][1][fileName]" value="second.jpg">
    <input name="threedobject_type[images][1][position]" value="1">
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Fallback fixture</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-fallback-123');
  assert.deepEqual(readback.imageNames, ['first.jpg', 'second.jpg']);
  assert.equal(readback.imageOrderSource, 'index');
  assert.equal(readback.primaryImage, '');
});

test('MyMiniFactory read-back accepts every boolean-attribute style the current editor emits', async () => {
  // Captured read-only from the live /object/edit page on 2026-08-03: the same
  // document uses selected="" for the license, selected="selected" for
  // visibility/technology/dimension units, and a bare checked for the remix
  // control. The license style previously parsed as null.
  const editHtml = `
    <input name="threedobject_type[name]" value="Boolean attribute styles">
    <select name="threedobject_type[visibility]"><option value="2">Public</option><option value="0" selected="selected">Private</option></select>
    <select name="license_id"><option value="4">BY-NC</option><option selected="" value="5">BY-NC-SA</option></select>
    <select name="threedobject_type[technology]"><option value="SLA">SLA</option><option value="FDM" selected="selected">FDM</option></select>
    <select name="threedobject_type[dimensionsUnit]"><option value="0" selected="selected">mm</option><option value="1">cm</option></select>
    <input name="categories" value="[60,462]">
    <input name="remix-checkbox" type="checkbox" checked>
    <input name="threedObjectRemixParents" value="829056,">
    <input type="hidden" name="threedobject_type[support_free]" value="1">
    <input name="data-selected-decoy" value="ignored">
  `;
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => new Response(String(url).includes('/object/edit/123') ? editHtml : '<title>Boolean attribute styles</title>', { status: 200 }),
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/3d-print-boolean-styles-123');
  assert.equal(readback.licenseId, 5, 'selected="" must be treated as the selected option');
  assert.equal(readback.visibility, 'private');
  assert.equal(readback.technology, 'FDM');
  assert.equal(readback.dimensionsUnit, 0);
  // The current editor renders support_free as a single hidden input carrying
  // the persisted value, not as a checkbox, so its value is the signal.
  assert.equal(readback.supportFree, true);
  assert.equal(readback.remix, true);
  assert.deepEqual(readback.remixParentIds, ['829056']);
});

test('MyMiniFactory re-reads an existing object addressed by bare numeric id through its canonical redirect', async () => {
  const editHtml = `
    <input name="threedobject_type[name]" value="Private remix test">
    <select name="threedobject_type[visibility]"><option value="0" selected>Private</option></select>
    <input name="categories" value="[60,462]">
    <input name="remix-checkbox" type="checkbox" checked>
    <input name="threedObjectRemixParents" value="829056,">
  `;
  const requests = [];
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), method: options.method || 'GET', redirect: options.redirect });
      if (String(url).includes('/object/edit/829284')) return new Response(editHtml, { status: 200 });
      // The managed Chromium session follows /object/<id> to the canonical slug.
      const followed = new Response('<title>Private remix test</title>', { status: 200 });
      Object.defineProperty(followed, 'url', { value: 'https://www.myminifactory.com/object/3d-print-private-remix-test-829284' });
      return followed;
    },
  });

  const readback = await client.status({ cookie: 'session=ok' }, 'https://www.myminifactory.com/object/829284');
  assert.equal(readback.url, 'https://www.myminifactory.com/object/3d-print-private-remix-test-829284');
  assert.equal(readback.visibility, 'private');
  assert.equal(readback.remix, true);
  assert.deepEqual(readback.remixParentIds, ['829056']);
  // Electron cancels a manual redirect with ERR_ABORTED; the object page must
  // follow it, and every request in a re-read stays a GET.
  assert.equal(requests[0].redirect, 'follow');
  assert.ok(requests.every((entry) => entry.method === 'GET'));
  assert.ok(requests.some((entry) => entry.url.includes('/object/edit/829284')));
});

test('MyMiniFactory loads the current category taxonomy from the authenticated endpoint', async () => {
  const client = createMyMiniFactoryDirectClient({
    fetchImpl: async (url) => {
      assert.equal(String(url), 'https://www.myminifactory.com/api/store/categories');
      return new Response(JSON.stringify([{ id: 60, name: 'Toys', children: [{ id: 462, name: 'Articulated', children: [] }] }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(await client.categories(context), [{ id: 60, name: 'Toys', children: [{ id: 462, name: 'Articulated', children: [] }] }]);
});

test('MyMiniFactory can reuse Electron Chromium networking for passwordless sessions', async () => {
  const calls = [];
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response(uploadHtml, { status: 200 });
    },
  });
  const identity = await client.whoami({ cookie: 'session=passwordless', userAgent: 'Electron-authenticated-UA' });
  assert.equal(identity.username, 'iamdjem');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.headers.Cookie, 'session=passwordless');
  assert.equal(calls[0].options.headers['User-Agent'], 'Electron-authenticated-UA');
});

test('managed MyMiniFactory submit follows Chromium redirect and reads the final object URL', async () => {
  const calls = [];
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    uuid: () => 'managed-upload-session',
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith('/upload/object') && (!options.method || options.method === 'GET')) {
        return new Response(uploadHtml, { status: 200 });
      }
      if (String(url).endsWith('/upload/object') && options.method === 'POST') {
        assert.equal(options.redirect, 'follow');
        const followed = new Response('<meta property="og:title" content="Managed private test">private object', { status: 200 });
        Object.defineProperties(followed, {
          redirected: { value: true },
          url: { value: 'https://www.myminifactory.com/object/3d-print-managed-private-test-67890' },
        });
        return followed;
      }
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const prepared = await client.prepare(context);
  const saved = await client.submit(context, {
    uploadSessionId: prepared.uploadSessionId,
    publication: 'private',
    title: 'Managed private test',
    images: [{ name: 'cover.jpg' }],
    files: [{ uuid: 'file-1' }],
    tags: [],
    categoryIds: [60, 462],
    licenseId: 5,
    confirmOriginalNoAi: true,
  });

  assert.equal(saved.url, 'https://www.myminifactory.com/object/3d-print-managed-private-test-67890');
  assert.equal(calls.at(-1).options.redirect, 'follow');
});

test('MyMiniFactory submit surfaces safe HTTP failure diagnostics without request secrets', async () => {
  const client = createMyMiniFactoryDirectClient({
    managedSession: true,
    uuid: () => 'diagnostic-upload-session',
    fetchImpl: async (url, options = {}) => {
      if (String(url).endsWith('/upload/object') && (!options.method || options.method === 'GET')) {
        return new Response(uploadHtml, { status: 200 });
      }
      if (String(url).endsWith('/upload/object') && options.method === 'POST') {
        return new Response('<html><title>Internal Server Error</title><div class="alert-danger">Uploaded files are still processing.</div><input value="csrf-should-not-leak"></html>', {
          status: 500,
          headers: { 'content-type': 'text/html; charset=utf-8', 'x-request-id': 'request-123' },
        });
      }
      throw new Error(`Unexpected request ${url}`);
    },
  });
  const prepared = await client.prepare({ cookie: 'session=secret-cookie' });
  await assert.rejects(
    () => client.submit({ cookie: 'session=secret-cookie' }, {
      uploadSessionId: prepared.uploadSessionId,
      publication: 'private',
      title: 'Diagnostic private test',
      images: [{ name: 'cover.jpg' }],
      files: [{ uuid: 'file-secret-uuid' }],
      tags: [],
      categoryIds: [60, 462],
      licenseId: 5,
      confirmOriginalNoAi: true,
    }),
    (error) => {
      assert.match(error.message, /HTTP 500/);
      assert.match(error.message, /\/upload\/object/);
      assert.match(error.message, /text\/html/);
      assert.match(error.message, /1 images, 1 files, 2 categories/);
      assert.match(error.message, /Uploaded files are still processing/);
      assert.match(error.message, /request-123/);
      assert.doesNotMatch(error.message, /secret-cookie|csrf-should-not-leak|file-secret-uuid/);
      return true;
    },
  );
});
