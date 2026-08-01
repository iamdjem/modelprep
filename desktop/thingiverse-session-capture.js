async function resolveThingiverseSessionCandidates(candidateReaders, validate) {
  for (const readCandidate of candidateReaders) {
    let candidate = null;
    try { candidate = await readCandidate(); } catch { /* try the next isolated source */ }
    if (!candidate) continue;
    if (candidate.context && candidate.identity) return candidate;
    const context = candidate;
    try {
      const identity = await validate(context);
      if (identity) return { context, identity };
    } catch { /* stale token/cookie; try the next source */ }
  }
  return null;
}

function normalizeThingiversePageCapture(data, cookie = '', legalApproved = true) {
  const context = normalizeThingiverseExchange(data?.exchange, cookie);
  const user = data?.identity?.data ?? data?.identity;
  if (!context || !user) return null;
  return {
    context,
    identity: {
      id: String(user.id || 'authenticated-session'),
      nickname: String(user.name || user.username || 'Thingiverse'),
      legalApproved: !!legalApproved,
    },
  };
}

function normalizeThingiverseExchange(data, cookie = '') {
  if (!data?.token || !data?.jwt?.access) return null;
  return {
    apiToken: String(data.token),
    accessToken: String(data.jwt.access),
    ...(cookie ? { cookie: String(cookie) } : {}),
  };
}

module.exports = { normalizeThingiverseExchange, normalizeThingiversePageCapture, resolveThingiverseSessionCandidates };
