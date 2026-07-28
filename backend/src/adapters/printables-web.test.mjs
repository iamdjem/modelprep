import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRINTABLES_LIMITS,
  printablesPresignUpload,
  printablesUpdateModel,
  validatePrintablesUploadRequest,
} from './printables-web.ts';

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
  let sent;
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(init.body);
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
    draft: true,
    authorship: 'author',
    aiGenerated: false,
    images: [{ id: 'image-1' }],
    stls: [{ id: 'stl-1', name: 'dragon.stl' }],
  });

  assert.equal(sent.variables.authorship, 'author');
  assert.equal(sent.variables.draft, true);
  assert.deepEqual(sent.variables.images, [{ id: 'image-1' }]);
  assert.deepEqual(sent.variables.stls, [{ id: 'stl-1', name: 'dragon.stl' }]);
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
