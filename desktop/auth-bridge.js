function validateWorkerUrl(rawUrl, workerUrl, platform = 'makerworld') {
  const target = new URL(rawUrl);
  const expected = new URL(workerUrl);
  if (!['makerworld', 'printables'].includes(platform)) {
    throw new Error('Blocked an unsupported desktop account platform.');
  }
  if (target.origin !== expected.origin || !target.pathname.startsWith(`/api/v1/${platform}/web/`)) {
    throw new Error(`Blocked an untrusted desktop ${platform} request destination.`);
  }
  return target.toString();
}

module.exports = { validateWorkerUrl };
