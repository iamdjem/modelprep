import { describe, expect, it } from 'vitest';
import { runBoundedJobs } from './asset-processing.js';

describe('bounded asset processing', () => {
  it('preserves result order and never exceeds its worker limit', async () => {
    let active = 0;
    let peak = 0;
    const results = await runBoundedJobs([1, 2, 3, 4, 5], async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    }, 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });
});
