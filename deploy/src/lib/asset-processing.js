export const DEFAULT_ASSET_WORKERS = 2;

export async function runBoundedJobs(items = [], worker, concurrency = DEFAULT_ASSET_WORKERS) {
  const queue = [...items];
  const results = new Array(queue.length);
  let cursor = 0;
  const slots = Array.from({ length: Math.max(1, Math.min(Number(concurrency) || 1, queue.length || 1)) }, async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(queue[index], index);
    }
  });
  await Promise.all(slots);
  return results;
}

export function hashFilesInWorkers(files = [], { concurrency = DEFAULT_ASSET_WORKERS, WorkerClass = globalThis.Worker } = {}) {
  if (!WorkerClass || !files.length) return Promise.resolve([]);
  return runBoundedJobs(files, (file) => new Promise((resolve) => {
    // Keep the URL literal inside the Worker constructor so Vite emits the
    // worker as a fingerprinted production asset.
    const worker = WorkerClass === globalThis.Worker
      ? new Worker(new URL('./asset-processing.worker.js', import.meta.url), { type: 'module' })
      : new WorkerClass(new URL('./asset-processing.worker.js', import.meta.url), { type: 'module' });
    const finish = (result) => { worker.terminate?.(); resolve(result); };
    worker.onmessage = (event) => finish(event.data);
    worker.onerror = () => finish({ id: file.id, hash: null, status: 'error' });
    // Blobs are structured-cloned without first materializing the complete file
    // on the renderer main thread. The worker owns the expensive read/digest.
    worker.postMessage({ id: file.id, blob: file.blob, name: file.name, size: file.size });
  }), concurrency);
}
