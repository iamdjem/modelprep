function createPrintablesSessionCache({ ttlMs = 5 * 60 * 1000, now = Date.now } = {}) {
  let cached = null;

  return {
    async validate(cookie, validator, { force = false } = {}) {
      if (!cookie) return null;
      if (!force && cached?.cookie === cookie && cached.expiresAt > now()) return cached.identity;
      const identity = await validator(cookie);
      if (!identity) {
        cached = null;
        return null;
      }
      cached = { cookie, identity, expiresAt: now() + ttlMs };
      return identity;
    },
    identityFor(cookie) {
      return cached?.cookie === cookie && cached.expiresAt > now() ? cached.identity : null;
    },
    clear() {
      cached = null;
    },
  };
}

module.exports = { createPrintablesSessionCache };
