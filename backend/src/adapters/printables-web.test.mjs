import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRINTABLES_LIMITS,
  printablesModelStatus,
  printablesPresignUpload,
  printablesResolveRemix,
  printablesUpdateModel,
  validatePrintablesUploadRequest,
} from './printables-web.ts';
import { PRINTABLES_META_SNAPSHOT } from './printables-meta-snapshot.ts';

test('bundled Printables taxonomy fallback preserves the audited category and license coverage', () => {
  assert.equal(PRINTABLES_META_SNAPSHOT.categories.length, 89);
  assert.equal(PRINTABLES_META_SNAPSHOT.licenses.length, 22);
  assert.equal(
    new Set(PRINTABLES_META_SNAPSHOT.categories.map((category) => category.id)).size,
    89,
  );
  assert.ok(PRINTABLES_META_SNAPSHOT.categories.some((category) => category.id === '36'));
  assert.ok(PRINTABLES_META_SNAPSHOT.licenses.some((license) => license.id === '3'));
});

test('model status requests complete metadata and every asset collection for readback verification', async (t) => {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return jsonResponse({ data: { model: { id: '123', images: [], stls: [], slas: [], gcodes: [], otherFiles: [] } } });
  };
  t.after(() => { globalThis.fetch = original; });

  await printablesModelStatus({ cookie: 'sessionid=x' }, '123');

  for (const field of ['summary', 'authorship', 'aiGenerated', 'politicalContent', 'category', 'license', 'tags', 'images', 'stls', 'slas', 'gcodes', 'otherFiles', 'remixParents']) {
    assert.match(sent[0].query, new RegExp(`\\b${field}\\b`));
  }
});

test('remix resolver converts current Printables URLs to model IDs and preserves external URLs', async (t) => {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    sent.push(request);
    return request.query.includes('ModelPrepRemixById')
      ? jsonResponse({ data: { model: { id: request.variables.id, license: { disallowRemixing: null } } } })
      : jsonResponse({ data: { remixUrlInfo: { url: request.variables.url } } });
  };
  t.after(() => { globalThis.fetch = original; });

  await printablesResolveRemix({ cookie: 'sessionid=x' }, 'https://www.printables.com/model/192914-example');
  await printablesResolveRemix({ cookie: 'sessionid=x' }, 'https://example.com/original');

  assert.equal(sent[0].variables.id, '192914');
  assert.equal(sent[1].variables.url, 'https://example.com/original');
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('presign sends the live printFileUpload2 shape and session only in Cookie', async (t) => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({
      data: {
        upload: {
          ok: true,
          errors: [],
          uploadData: { url: 'https://storage.example', fields: { key: 'x' } },
          fileUpload: { id: 'upload-1' },
        },
      },
    });
  };
  t.after(() => { globalThis.fetch = original; });

  const result = await printablesPresignUpload(
    { cookie: 'sessionid=secret' },
    { fileName: 'dragon.3mf', folder: '', unzip: true },
  );

  assert.equal(result.fileUpload.id, 'upload-1');
  assert.equal(calls[0].url, 'https://api.printables.com/graphql/');
  assert.equal(calls[0].init.headers.Cookie, 'sessionid=secret');
  const sent = JSON.parse(calls[0].init.body);
  assert.match(sent.query, /printFileUpload2/);
  assert.deepEqual(sent.variables, {
    fileName: 'dragon.3mf',
    folder: '',
    unzip: true,
    imageHash: null,
    imageHeight: null,
    imageWidth: null,
  });
});

test('model update preserves Printables lower-case authorship and draft flag', async (t) => {
  const sent = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    sent.push(request);
    return jsonResponse({
      data: {
        modelUpdate: {
          ok: true,
          errors: [],
          output: { id: '123', slug: 'dragon', datePublished: null },
        },
      },
    });
  };
  t.after(() => { globalThis.fetch = original; });

  await printablesUpdateModel({ cookie: 'sessionid=x' }, {
    name: 'Dragon',
    tags: ['dragon', 'print in place'],
    draft: true,
    authorship: 'author',
    aiGenerated: false,
    images: [{ id: 'image-1' }],
    stls: [{ id: 'stl-1', name: 'dragon.stl' }],
  });

  assert.equal(sent[0].variables.authorship, 'author');
  assert.equal(sent[0].variables.draft, true);
  assert.deepEqual(sent[0].variables.tags, ['dragon', 'printinplace']);
  assert.deepEqual(sent[0].variables.images, [{ id: 'image-1' }]);
  assert.deepEqual(sent[0].variables.stls, [{ id: 'stl-1', name: 'dragon.stl' }]);
});

test('file-size validation implements Printables normal and archive caps', () => {
  assert.deepEqual(
    validatePrintablesUploadRequest(
      { fileName: 'model.3mf' },
      PRINTABLES_LIMITS.fileBytes + 1,
    ),
    ['File is larger than the 1024 MiB Printables limit.'],
  );
  assert.deepEqual(
    validatePrintablesUploadRequest(
      { fileName: 'bundle.zip', unzip: false },
      PRINTABLES_LIMITS.zipBytes + 1,
    ),
    ['File is larger than the 256 MiB Printables limit.'],
  );
});

test('GraphQL and rate-limit errors are surfaced clearly', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ errors: [{ message: 'Not authenticated' }] });
  t.after(() => { globalThis.fetch = original; });
  await assert.rejects(
    printablesPresignUpload({ cookie: 'expired' }, { fileName: 'x.stl' }),
    /session is no longer authorized/i,
  );

  globalThis.fetch = async () => new Response('slow down', { status: 429 });
  await assert.rejects(
    printablesPresignUpload({ cookie: 'x' }, { fileName: 'x.stl' }),
    /rate limit/i,
  );

  globalThis.fetch = async () => new Response('user_is_not_authenticated', { status: 200 });
  await assert.rejects(
    printablesPresignUpload({ cookie: 'expired' }, { fileName: 'x.stl' }),
    /session is no longer authorized/i,
  );
});
