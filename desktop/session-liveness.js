'use strict';
// Is a platform session still alive, judged by its cookie jar.
//
// The launch check and the keep-alive both ask each platform "who am I" over
// the network. When that answer does not come back (Cloudflare challenging a
// fresh process, a 429 after a burst of relaunches, a stalled request), the
// renderer used to read the silence as "signed out" and flip the account to
// Reconnect, while a perfectly good session sat in the jar. Printables was
// fixed first (printables-session.js); this is the same rule for the rest:
// only a missing or expired session cookie means signed out.
//
// Pure: takes the cookie list Electron's session.cookies.get({}) returns.

const SESSION_COOKIES = Object.freeze({
  mmf: { domain: 'myminifactory.com', names: ['PHPSESSID'] },
  makeroad: { domain: 'makeroad.com', names: ['X-Token'] },
  cults: { domain: 'cults3d.com', names: ['_session_id'] },
  nexprint: { domain: 'nexprint.com', names: [] },
  creality: { domain: 'crealitycloud.com', names: [] },
  makeronline: { domain: 'makeronline.com', names: [] },
  thingiverse: { domain: 'thingiverse.com', names: [] },
  thangs: { domain: 'thangs.com', names: [] },
});

// When a platform has no known session cookie name, anything that smells like
// one counts, as long as it is on the platform's domain and not expired.
const SESSION_LIKE = /session|token|auth|sid|login|jwt/i;

function onDomain(cookie, domain) {
  const host = String(cookie?.domain || '').replace(/^\./, '').toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

function unexpired(cookie, nowSeconds) {
  // Electron reports expirationDate in seconds; a session cookie has none and
  // lives as long as the partition does.
  if (cookie?.expirationDate == null) return true;
  return Number(cookie.expirationDate) > nowSeconds;
}

/**
 * @param {Array} cookies from session.cookies.get({})
 * @param {string} platform
 * @param {number} [now] ms
 * @returns {{alive: boolean, cookie: string|null, expiresAt: number|null}}
 */
function sessionCookieLiveness(cookies, platform, now = Date.now()) {
  const spec = SESSION_COOKIES[platform];
  if (!spec) return { alive: false, cookie: null, expiresAt: null };
  const nowSeconds = now / 1000;
  const onSite = (cookies || []).filter((cookie) => onDomain(cookie, spec.domain));
  const candidates = spec.names.length
    ? onSite.filter((cookie) => spec.names.includes(cookie.name))
    : onSite.filter((cookie) => SESSION_LIKE.test(String(cookie.name || '')));
  const live = candidates.filter((cookie) => unexpired(cookie, nowSeconds) && String(cookie.value || '').length > 0);
  if (!live.length) return { alive: false, cookie: null, expiresAt: null };
  const soonest = live.reduce((min, cookie) => (cookie.expirationDate == null ? min : Math.min(min, cookie.expirationDate * 1000)), Infinity);
  return { alive: true, cookie: live[0].name, expiresAt: Number.isFinite(soonest) ? soonest : null };
}

// Did the platform say "you are signed out", or did it just not answer?
// "Token错误" (MakerRoad: token error), 401, "unauthorized", "login required"
// are the platform speaking. "Redirect was cancelled", ECONNRESET, a timeout,
// a Cloudflare challenge page are the network or the client. Only the first
// kind may override a live cookie.
const DEFINITE_SIGN_OUT = /token错误|token (is )?(invalid|expired|missing)|invalid token|unauthori[sz]ed|not (logged|signed) in|login (is )?required|please (log|sign) in|session (has )?expired|\b401\b|\b403\b/i;
function isDefiniteSignOut(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  const code = error && typeof error === 'object' ? String(error.code || error.status || '') : '';
  if (/^(401|403)$/.test(code)) return true;
  return DEFINITE_SIGN_OUT.test(message);
}

module.exports = { sessionCookieLiveness, isDefiniteSignOut, SESSION_COOKIES };
