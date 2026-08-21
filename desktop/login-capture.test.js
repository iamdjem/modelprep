const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { runLoginCapture } = require('./login-capture');

// Minimal stand-in for the Electron BrowserWindow used by the sign-in flow.
function fakeWindow() {
  const win = new EventEmitter();
  win.webContents = new EventEmitter();
  win.destroyed = false;
  win.isDestroyed = () => win.destroyed;
  win.close = () => { win.destroyed = true; };
  // What the user does: close the window by hand.
  win.userCloses = () => { win.emit('close'); win.destroyed = true; win.emit('closed'); };
  return win;
}

const opts = (login, attempt, extra = {}) => ({
  login,
  attempt,
  timeoutMessage: 'timed out',
  intervalMs: 10,
  finalAttemptMs: 100,
  ...extra,
});

test('resolves as soon as a navigation reveals the session', async () => {
  const login = fakeWindow();
  let signedIn = false;
  const promise = runLoginCapture(opts(login, async () => (signedIn ? { session: 'ok' } : null)));

  signedIn = true;
  login.webContents.emit('did-navigate');

  assert.deepEqual(await promise, { session: 'ok' });
  assert.equal(login.isDestroyed(), true, 'the window closes itself on success');
});

// The regression this module exists for: the session lands, the user closes the
// window before anything says so, and the capture must not throw it away.
test('recovers a session established just before the user closes the window', async () => {
  const login = fakeWindow();
  let signedIn = false;
  const promise = runLoginCapture(opts(login, async () => (signedIn ? { session: 'late' } : null)));

  signedIn = true;          // sign-in completed, nothing has polled yet
  login.userCloses();

  assert.deepEqual(await promise, { session: 'late' });
});

test('still reports a genuine cancellation when no session exists', async () => {
  const login = fakeWindow();
  const promise = runLoginCapture(opts(login, async () => null));

  login.userCloses();

  await assert.rejects(promise, /Sign-in window was closed/);
});

test('marks the closing attempt as final so it can bypass caching', async () => {
  const login = fakeWindow();
  const seen = [];
  const promise = runLoginCapture(opts(login, async ({ final = false } = {}) => {
    seen.push(final);
    return final ? { session: 'forced' } : null;
  }));

  login.userCloses();

  assert.deepEqual(await promise, { session: 'forced' });
  assert.equal(seen.at(-1), true, 'the last attempt is flagged final');
  assert.ok(seen.slice(0, -1).every((flag) => flag === false), 'ordinary attempts are not');
});

test('never runs two attempts at once', async () => {
  const login = fakeWindow();
  let active = 0;
  let overlapped = false;
  let signedIn = false;
  const promise = runLoginCapture(opts(login, async () => {
    active += 1;
    if (active > 1) overlapped = true;
    await new Promise((r) => setTimeout(r, 30));   // slower than the 10ms poll
    active -= 1;
    return signedIn ? { session: 'ok' } : null;
  }));

  await new Promise((r) => setTimeout(r, 120));
  signedIn = true;
  await promise;
  assert.equal(overlapped, false);
});

test('a hung final attempt cannot wedge the sign-in forever', async () => {
  const login = fakeWindow();
  const promise = runLoginCapture(opts(login, async ({ final = false } = {}) => {
    if (final) await new Promise(() => {});        // never settles
    return null;
  }));

  login.userCloses();

  await assert.rejects(promise, /Sign-in window was closed/);
});

test('rejects with the platform timeout message when nothing happens', async () => {
  const login = fakeWindow();
  await assert.rejects(
    runLoginCapture(opts(login, async () => null, { timeoutMs: 40 })),
    /timed out/,
  );
});

// The reported bug: sign-in finishes, and the window sits there. A platform that
// can watch its own session (a cookie appearing in the partition) says so, and
// the window closes on that signal rather than on the next poll.
test('closes on a live signal without waiting for the poll', async () => {
  const login = fakeWindow();
  let signedIn = false;
  let fire = null;
  let unsubscribed = false;
  const promise = runLoginCapture(opts(login, async () => (signedIn ? { session: 'ok' } : null), {
    intervalMs: 60_000,                    // the poll cannot be what saves this
    subscribe: (tryCapture) => { fire = tryCapture; return () => { unsubscribed = true; }; },
  }));

  signedIn = true;
  fire();

  assert.deepEqual(await promise, { session: 'ok' });
  assert.equal(login.isDestroyed(), true, 'the window closes itself');
  assert.equal(unsubscribed, true, 'and stops listening');
});

test('a subscription that throws leaves the poll in charge', async () => {
  const login = fakeWindow();
  let signedIn = false;
  const promise = runLoginCapture(opts(login, async () => (signedIn ? { session: 'polled' } : null), {
    subscribe: () => { throw new Error('no cookies API here'); },
  }));

  signedIn = true;
  assert.deepEqual(await promise, { session: 'polled' });
});

// An attempt that hangs used to hold the in-flight lock for the whole sign-in, so
// every later poll returned without doing anything and the window never closed.
test('a hung attempt does not wedge the ones after it', async () => {
  const login = fakeWindow();
  let calls = 0;
  const promise = runLoginCapture(opts(login, async () => {
    calls += 1;
    if (calls === 1) { await new Promise(() => {}); }   // first attempt never answers
    return { session: 'recovered' };
  }, { attemptTimeoutMs: 30 }));

  assert.deepEqual(await promise, { session: 'recovered' });
  assert.ok(calls >= 2, 'a later attempt ran');
});
