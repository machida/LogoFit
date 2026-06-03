import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_OUTPUTS, mapLimit, outputTotals } from './limits';
import type { OutputPreset } from './types';

const preset = (width: number, height: number): OutputPreset => ({ id: 'p', prefix: '', width, height });

describe('mapLimit', () => {
  it('preserves input order', async () => {
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('caps concurrency at the given limit', async () => {
    let active = 0;
    let maxActive = 0;
    await mapLimit([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      await Promise.resolve();
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBeGreaterThan(0);
  });

  it('propagates errors', async () => {
    await expect(
      mapLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('x');
        return n;
      }),
    ).rejects.toThrow('x');
  });

  it('stops scheduling new work once aborted', async () => {
    const processed: number[] = [];
    let calls = 0;
    await mapLimit(
      [1, 2, 3, 4, 5, 6],
      1,
      async (n) => {
        calls++;
        processed.push(n);
      },
      () => calls >= 2,
    );
    expect(processed).toEqual([1, 2]);
  });
});

describe('outputTotals', () => {
  it('computes count and estimated pixels', () => {
    const t = outputTotals(3, [preset(100, 100), preset(200, 200)]);
    expect(t.count).toBe(6);
    expect(t.pixels).toBe(3 * (10000 + 40000));
    expect(t.exceeds).toBe(false);
  });

  it('flags exceed when count is over the limit', () => {
    const t = outputTotals(MAX_TOTAL_OUTPUTS + 1, [preset(1, 1)]);
    expect(t.exceeds).toBe(true);
  });
});
