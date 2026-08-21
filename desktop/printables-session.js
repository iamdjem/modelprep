'use strict';

// What counts as "signed in to Printables", and how sure we are.
//
// Printables signs people in through Prusa's OAuth hand-back, which writes
// `auth.access_token` and `auth.refresh_token` into our partition at the moment
// the sign-in completes. Those two cookies ARE the session. Everything else on
// the domain (cookieyes-consent, cf_clearance, client-uid, the api subdomain's
// csrftoken) is already there before anyone signs in and says nothing about it.
//
// Detecting sign-in from the cookies rather than from an API round trip is the
// whole point: it is local, immediate, and cannot be rate-limited, so the
// sign-in window can close itself the instant the session exists.

const PRINTABLES_AUTH_COOKIES = ['auth.access_token', 'auth.refresh_token'];

function onPrintablesDomain(cookie) {
  const domain = String(cookie?.domain || '').replace(/^\./, '').toLowerCase();
  return domain === 'printables.com' || domain.endsWith('.printables.com');
}

// Expired cookies linger in the jar. An expired access token is not a session,
// and `expirationDate` is in seconds (Electron's shape), not milliseconds.
function printablesSessionCookiePresent(records, nowMs = Date.now()) {
  return (Array.isArray(records) ? records : []).some((cookie) => (
    PRINTABLES_AUTH_COOKIES.includes(cookie?.name)
    && !!cookie?.value
    && (!cookie.expirationDate || cookie.expirationDate * 1000 > nowMs)
  ));
}

function printablesCookieHeader(records) {
  const list = (Array.isArray(records) ? records : []).filter((cookie) => cookie?.name);
  if (!list.length) return null;
  return list.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

// Three answers, not two.
//
// `signed-out` is something Printables told us: it answered, and the answer was
// no account. `unknown` is a rate limit (429), a timeout, a dropped connection:
// we learned nothing. Collapsing those two into "not signed in" is what made a
// finished sign-in look like a failed one, because every inconclusive check
// counted as evidence against a session that was sitting right there in the jar.
async function printablesWhoamiState(cookie, whoami) {
  if (!cookie) return { state: 'signed-out' };
  try {
    const identity = await whoami(cookie);
    return identity ? { state: 'signed-in', identity } : { state: 'signed-out' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The one throw that is still a definite answer: Printables rejected the
    // session rather than failing to answer.
    if (/no longer authorized/i.test(message)) return { state: 'signed-out', message };
    return { state: 'unknown', message };
  }
}

// The sign-in window must not be able to hang on this check, wherever it stalls:
// the fetch layer has its own timeout, and this caps the answer as a whole. An
// expired budget is `unknown`, which is the answer that lets the cookie decide.
function printablesWhoamiStateWithin(cookie, whoami, timeoutMs) {
  let timer = null;
  const budget = new Promise((settle) => {
    timer = setTimeout(
      () => settle({ state: 'unknown', message: 'identity check exceeded its budget' }),
      timeoutMs,
    );
  });
  return Promise.race([printablesWhoamiState(cookie, whoami), budget])
    .finally(() => clearTimeout(timer));
}

module.exports = {
  PRINTABLES_AUTH_COOKIES,
  onPrintablesDomain,
  printablesCookieHeader,
  printablesSessionCookiePresent,
  printablesWhoamiState,
  printablesWhoamiStateWithin,
};
