'use strict';

// Session keep-alive: periodically re-runs each platform's silent recovery
// ladder so long-lived sessions stay signed in instead of quietly expiring
// between uses. Cookie-session platforms (Printables, MyMiniFactory,
// MakerRoad) rely on sliding rotation that only happens when their site is
// actually touched; before this module existed nothing touched them between
// publishes, so they were the first to sign out.
//
// Pure module in the release-scheduler.js style: no electron/fs imports, all
// effects injected, so the loop is unit-testable. Rules:
//   - refresh only platforms that report stored session material;
//   - run sequentially, never in parallel (ten concurrent page warms is a
//     thundering herd against Cloudflare-fronted sites);
//   - a failed refresh is recorded and skipped, never surfaced: keep-alive
//     must not flip an account to "reconnect" on a flaky network. The
//     existing launch discovery and publish-time checks own user-visible
//     status.

const HOUR = 60 * 60 * 1000;

function createSessionKeepAlive({
  platforms = [],
  hasSession,
  refresh,
  now = Date.now,
  intervalMs = 6 * HOUR,
  initialDelayMs = 10 * 60 * 1000,
  log = () => {},
} = {}) {
  if (typeof hasSession !== 'function' || typeof refresh !== 'function') {
    throw new Error('session keep-alive requires hasSession and refresh functions');
  }
  let timer = null;
  let initialTimer = null;
  let running = false;
  const lastResults = new Map(); // platform -> { at, ok }

  async function tick() {
    if (running) return lastResults; // a slow previous pass is still going
    running = true;
    try {
      for (const platform of platforms) {
        let stored = false;
        try { stored = !!(await hasSession(platform)); } catch { stored = false; }
        if (!stored) continue;
        let ok = false;
        try { ok = !!(await refresh(platform)); } catch { ok = false; }
        lastResults.set(platform, { at: now(), ok });
        log(`[session-keepalive] ${platform}: ${ok ? 'refreshed' : 'skipped (silent recovery failed)'}`);
      }
    } finally {
      running = false;
    }
    return lastResults;
  }

  function start() {
    if (timer || initialTimer) return;
    // Launch discovery already force-validates everything at startup; the
    // first keep-alive pass waits so the two never overlap.
    initialTimer = setTimeout(() => { initialTimer = null; tick(); }, initialDelayMs);
    if (typeof initialTimer.unref === 'function') initialTimer.unref();
    timer = setInterval(tick, intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function stop() {
    if (initialTimer) { clearTimeout(initialTimer); initialTimer = null; }
    if (timer) { clearInterval(timer); timer = null; }
  }

  return { start, stop, tick, lastResults };
}

module.exports = { createSessionKeepAlive };
