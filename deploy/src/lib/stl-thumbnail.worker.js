// Parses and rasterises an STL off the main thread. A real print file runs to
// millions of triangles; doing this inline would freeze the UI mid-import, which
// is exactly when the app must stay responsive.
import { stlThumbnailFromBuffer } from './stl-thumbnail.js';

self.onmessage = (event) => {
  const { id, buffer, size } = event.data || {};
  try {
    const result = stlThumbnailFromBuffer(buffer, { size });
    if (!result) { self.postMessage({ id, ok: false }); return; }
    // Transfer the pixels rather than copying them.
    self.postMessage({ id, ok: true, data: result.data, size: result.size }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
