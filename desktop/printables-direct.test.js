const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GRAPHQL_CLIENT_VERSION,
  handlePrintablesRequest,
  printablesWhoamiDirect,
} = require('./printables-direct');

function graphQlResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('desktop Printables identity probe calls GraphQL from the user connection with the session cookie', async () => {
  const calls = [];
  const user = await printablesWhoamiDirect('sessionid=private', async (url, init) => {
    calls.push({ url, init });
    return graphQlResponse({ data: { me: { id: '3163385', handle: 'iamdjem' } } });
  });

  assert.equal(user.handle, 'iamdjem');
  assert.equal(calls[0].url, 'https://api.printables.com/graphql/');
  assert.equal(calls[0].init.headers.Cookie, 'sessionid=private');
  assert.equal(calls[0].init.headers['Graphql-Client-Version'], GRAPHQL_CLIENT_VERSION);
});

test('desktop route relay preserves the Worker-compatible whoami response without exposing cookies', async () => {
  const result = await handlePrintablesRequest({
    url: 'https://worker.example/api/v1/printables/web/whoami',
    method: 'GET',
    bodyType: 'none',
  }, 'sessionid=private', async () =>
    graphQlResponse({ data: { me: { id: '3163385', handle: 'iamdjem' } } }));

  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(result.body), {
    ok: true,
    id: '3163385',
    handle: 'iamdjem',
  });
  assert.doesNotMatch(result.body, /sessionid|private/);
});

test('desktop route relay validates upload size before requesting a presign', async () => {
  let called = false;
  const result = await handlePrintablesRequest({
    url: 'https://worker.example/api/v1/printables/web/upload/presign',
    method: 'POST',
    bodyType: 'text',
    body: JSON.stringify({
      fileName: 'archive.zip',
      size: 300 * 1024 * 1024,
      unzip: false,
    }),
  }, 'sessionid=private', async () => {
    called = true;
    return graphQlResponse({ data: {} });
  });

  assert.equal(result.status, 400);
  assert.equal(called, false);
  assert.match(result.body, /256 MiB/);
});

test('desktop model relay sends canonical Printables tag labels, not numeric IDs', async () => {
  const calls = [];
  const result = await handlePrintablesRequest({
    url: 'https://worker.example/api/v1/printables/web/model',
    method: 'POST',
    bodyType: 'text',
    body: JSON.stringify({
      name: 'Dragon',
      tags: ['print in place', 'no-supports', 'dragon'],
      draft: true,
    }),
  }, 'sessionid=private', async (_url, init) => {
    const request = JSON.parse(init.body);
    calls.push(request);
    return graphQlResponse({
      data: {
        modelUpdate: {
          ok: true,
          errors: [],
          output: { id: '123', name: 'Dragon', datePublished: null },
        },
      },
    });
  });

  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].variables.tags, ['printinplace', 'nosupports', 'dragon']);
});

test('desktop model list uses the current argument-free drafts query', async () => {
  const calls = [];
  const result = await handlePrintablesRequest({
    url: 'https://worker.example/api/v1/printables/web/my-models',
    method: 'GET',
    bodyType: 'none',
  }, 'sessionid=private', async (_url, init) => {
    const request = JSON.parse(init.body);
    calls.push(request);
    if (request.query.includes('ModelPrepPrintablesMe')) {
      return graphQlResponse({ data: { me: { id: '3163385', handle: 'iamdjem' } } });
    }
    return graphQlResponse({
      data: {
        drafts: [{ id: '1793654', name: 'Dragon' }],
        published: { items: [], cursor: null },
      },
    });
  });

  assert.equal(result.status, 200);
  assert.doesNotMatch(calls[1].query, /drafts\s*\(/);
  assert.deepEqual(JSON.parse(result.body).drafts, [{ id: '1793654', name: 'Dragon' }]);
});
