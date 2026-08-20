// Parses and rasterises an STL off the main thread. A real print file runs to
// millions of triangles; doing this inline would freeze the UI mid-import, which
// is exactly when the app must stay responsive.
import { meshBounds, parseStlTriangles, stlThumbnailFromBuffer } from './stl-thumbnail.js';

const INTERACTIVE_TRIANGLE_BUDGET = 120_000;

self.onmessage = async (event) => {
  const { id, blob, size, mode } = event.data || {};
  try {
    const buffer = await blob.arrayBuffer();
    if (mode === 'mesh') {
      const triangles = parseStlTriangles(buffer, { budget: INTERACTIVE_TRIANGLE_BUDGET });
      if (!triangles.length) { self.postMessage({ id, ok: false }); return; }
      self.postMessage({ id, ok: true, triangles, bounds: meshBounds(triangles) }, [triangles.buffer]);
      return;
    }
    const result = stlThumbnailFromBuffer(buffer, { size });
    if (!result) { self.postMessage({ id, ok: false }); return; }
    // Transfer the pixels rather than copying them.
    self.postMessage({ id, ok: true, data: result.data, size: result.size, bounds: result.bounds }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
