// Shared driver for every platform's sign-in window.
//
// `attempt` returns the captured session (any truthy value) once the platform has
// signed the user in, or a falsy value while that is still pending. It is called:
//   - on every navigation in the window, so a completed sign-in is noticed at once
//     rather than up to a poll interval later;
//   - on a slow poll, to catch sessions established without a navigation (OAuth
//     popups, in-page XHR logins);
//   - whenever `subscribe` says something happened, for platforms that can watch
//     their own session directly (a cookie appearing in the partition), so the
//     window closes within a tick of sign-in instead of waiting for a poll;
//   - ONE FINAL TIME when the window is closed.
//
// That last call is the important one. The platform writes its session into our
// partition the moment sign-in succeeds, but nothing in the window tells the user
// we noticed. People close the window expecting to be done, and rejecting right
// there threw away a session that genuinely existed. The next connect attempt then
// found the stored session and succeeded, which is why signing in appeared to need
// two tries.
//
// Attempts never overlap: a slow validation cannot stack up behind the poll. But
// "never overlap" must not become "never run again": an attempt that hangs (a
// platform API that accepts the connection and then says nothing) used to hold the
// in-flight lock forever, so every later poll returned immediately, the window
// never closed itself, and the close-time attempt was the only one left to save
// the sign-in. After `attemptTimeoutMs` the lock is released and polling resumes.
// A late answer from the abandoned attempt is still honoured if it arrives.
const FINAL_ATTEMPT_TIMEOUT_MS = 8000;
const ATTEMPT_TIMEOUT_MS = 20000;

function runLoginCapture({
  login,
  attempt,
  timeoutMessage,
  timeoutMs = 5 * 60 * 1000,
  intervalMs = 2500,
  finalAttemptMs = FINAL_ATTEMPT_TIMEOUT_MS,
  attemptTimeoutMs = ATTEMPT_TIMEOUT_MS,
  // (tryCapture) => unsubscribe. Optional live signal from the platform's own
  // session, for capture paths that do not have to ask the network.
  subscribe = null,
}) {
  return new Promise((resolve, reject) => {
    let done = false;
    let inFlight = false;
    let unsubscribe = null;
    const stop = () => {
      clearInterval(poll);
      clearTimeout(timer);
      if (unsubscribe) { try { unsubscribe(); } catch { /* already gone */ } unsubscribe = null; }
    };
    const settle = (fn, value) => {
      if (done) return;
      done = true;
      stop();
      if (!login.isDestroyed()) login.close();
      fn(value);
    };
    const tryCapture = async () => {
      if (done || inFlight) return null;
      inFlight = true;
      const release = setTimeout(() => { inFlight = false; }, attemptTimeoutMs);
      try {
        const captured = await attempt();
        if (captured) settle(resolve, captured);
        return captured;
      } catch {
        return null;                       // keep waiting; sign-in may still be in progress
      } finally {
        clearTimeout(release);
        inFlight = false;
      }
    };
    const poll = setInterval(tryCapture, intervalMs);
    if (subscribe) {
      try {
        const off = subscribe(tryCapture) || null;
        // A subscription that captured before it returned has already run stop().
        if (done) { try { off?.(); } catch { /* already gone */ } } else { unsubscribe = off; }
      } catch { /* the poll still covers it */ }
    }
    const timer = setTimeout(() => settle(reject, new Error(timeoutMessage)), timeoutMs);
    try {
      login.webContents.on('did-navigate', tryCapture);
      login.webContents.on('did-navigate-in-page', tryCapture);
      login.webContents.on('did-finish-load', tryCapture);
      // `close` fires while webContents is still alive, so captures that read the
      // live page (rather than the session partition) still have something to read.
      login.on('close', tryCapture);
    } catch { /* window already gone */ }
    login.on('closed', async () => {
      if (done) return;
      stop();
      try {
        // `final` lets an attempt bypass any "already checked this" shortcut: this
        // is the last chance to notice a session the user just established.
        // Bounded so a hung validation cannot leave Connect spinning forever.
        const captured = await Promise.race([
          attempt({ final: true }),
          new Promise((settleRace) => setTimeout(() => settleRace(null), finalAttemptMs)),
        ]);
        if (captured && !done) { done = true; resolve(captured); return; }
      } catch { /* fall through to cancellation */ }
      if (!done) { done = true; reject(new Error('Sign-in window was closed.')); }
    });
  });
}

module.exports = { runLoginCapture };
