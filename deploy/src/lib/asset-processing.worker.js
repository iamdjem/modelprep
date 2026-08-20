self.onmessage = async (event) => {
  const { id, blob, name = '', size = 0 } = event.data || {};
  try {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    self.postMessage({ id, hash, name, size, status: 'ready' });
  } catch (error) {
    self.postMessage({ id, hash: null, name, size, status: 'error', error: error?.message || 'Hashing failed' });
  }
};
