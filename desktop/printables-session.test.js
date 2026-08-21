const test = require('node:test');
const assert = require('node:assert/strict');

const {
  onPrintablesDomain,
  printablesCookieHeader,
  printablesSessionCookiePresent,
  printablesWhoamiState,
  printablesWhoamiStateWithin,
} = require('./printables-session');

// The jar as it actually looks on a signed-out visit to printables.com, taken
// from a live partition: consent, Cloudflare and analytics, no session.
const SIGNED_OUT = [
  { domain: '.printables.com', name: 'cookieyes-consent', value: 'consented' },
  { domain: '.printables.com', name: 'cf_clearance', value: 'clear' },
  { domain: 'www.printables.com', name: 'client-uid', value: 'uid' },
  { domain: 'api.printables.com', name: 'csrftoken', value: 'csrf' },
];

const hour = (n) => Math.floor(Date.now() / 1000) + n * 3600;

test('cookies that exist before sign-in are not a session', () => {
  assert.equal(printablesSessionCookiePresent(SIGNED_OUT), false);
});

test('the auth cookie Prusa hands back is', () => {
  const signedIn = [
    ...SIGNED_OUT,
    { domain: '.printables.com', name: 'auth.access_token', value: 'a', expirationDate: hour(2) },
    { domain: '.printables.com', name: 'auth.refresh_token', value: 'r', expirationDate: hour(720) },
  ];
  assert.equal(printablesSessionCookiePresent(signedIn), true);
});

test('a refresh token alone still counts: the site rotates the access token itself', () => {
  const rotating = [
    ...SIGNED_OUT,
    { domain: '.printables.com', name: 'auth.refresh_token', value: 'r', expirationDate: hour(720) },
  ];
  assert.equal(printablesSessionCookiePresent(rotating), true);
});

test('an expired access token is not a session', () => {
  const stale = [
    { domain: '.printables.com', name: 'auth.access_token', value: 'a', expirationDate: hour(-1) },
  ];
  assert.equal(printablesSessionCookiePresent(stale), false);
});

test('an empty auth cookie is not a session', () => {
  const blank = [{ domain: '.printables.com', name: 'auth.access_token', value: '' }];
  assert.equal(printablesSessionCookiePresent(blank), false);
});

test('the header keeps every cookie on the domain, in jar order', () => {
  assert.equal(
    printablesCookieHeader(SIGNED_OUT),
    'cookieyes-consent=consented; cf_clearance=clear; client-uid=uid; csrftoken=csrf',
  );
  assert.equal(printablesCookieHeader([]), null);
});

test('the domain filter takes the api and www subdomains, and nothing else', () => {
  assert.equal(onPrintablesDomain({ domain: '.printables.com' }), true);
  assert.equal(onPrintablesDomain({ domain: 'api.printables.com' }), true);
  assert.equal(onPrintablesDomain({ domain: 'printables.com' }), true);
  assert.equal(onPrintablesDomain({ domain: '.prusa3d.com' }), false);
  assert.equal(onPrintablesDomain({ domain: 'notprintables.com' }), false);
  assert.equal(onPrintablesDomain({}), false);
});

test('an answered check reports what it was told', async () => {
  assert.deepEqual(
    await printablesWhoamiState('c', async () => ({ handle: 'alex' })),
    { state: 'signed-in', identity: { handle: 'alex' } },
  );
  assert.deepEqual(await printablesWhoamiState('c', async () => null), { state: 'signed-out' });
});

// The distinction the whole fix rests on: a check that could not run is not
// evidence that the person is signed out.
test('a rate limit is unknown, not signed out', async () => {
  const result = await printablesWhoamiState('c', async () => {
    throw new Error('Printables rate limit reached. Wait a moment and try again.');
  });
  assert.equal(result.state, 'unknown');
});

test('a timeout is unknown, not signed out', async () => {
  const result = await printablesWhoamiState('c', async () => {
    throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  });
  assert.equal(result.state, 'unknown');
});

test('a rejected session is signed out, because Printables answered', async () => {
  const result = await printablesWhoamiState('c', async () => {
    throw new Error('Printables session is no longer authorized: token_is_expired');
  });
  assert.equal(result.state, 'signed-out');
});

test('no cookie is signed out without asking anyone', async () => {
  let asked = false;
  const result = await printablesWhoamiState(null, async () => { asked = true; return {}; });
  assert.deepEqual(result, { state: 'signed-out' });
  assert.equal(asked, false);
});

// A check that never answers is the case that used to hold the sign-in window
// open over a session that already existed.
test('a check that never answers gives up inside its budget', async () => {
  const started = Date.now();
  const result = await printablesWhoamiStateWithin('c', () => new Promise(() => {}), 40);
  assert.equal(result.state, 'unknown');
  assert.ok(Date.now() - started < 1000, 'and does not wait for it');
});

test('a check that answers in time is not disturbed by the budget', async () => {
  const result = await printablesWhoamiStateWithin('c', async () => ({ handle: 'alex' }), 1000);
  assert.deepEqual(result, { state: 'signed-in', identity: { handle: 'alex' } });
});
