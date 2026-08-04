function cultsChromiumUserAgent(chromeVersion = process.versions.chrome) {
  const version = String(chromeVersion || '').trim();
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('A full Chromium version is required for the Cults3D browser profile.');
  }
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

function isCultsChallengePage({ title = '', url = '' } = {}) {
  return /just a moment|attention required|security verification/i.test(String(title))
    || /\/cdn-cgi\/challenge-platform\//i.test(String(url));
}

module.exports = { cultsChromiumUserAgent, isCultsChallengePage };
