import { describe, expect, it } from 'vitest';
import { createCoalescingQueue } from './writeQueue';

describe('createCoalescingQueue', () => {
  it('runs the first request, then only the latest of those queued during it', async () => {
    const performed: string[] = [];
    const enqueue = createCoalescingQueue<string>(async (v) => {
      performed.push(v);
    });
    await Promise.all([enqueue('A'), enqueue('B'), enqueue('C')]);
    // A は即実行、B は C に上書きされて飛ばされ、最後に C が実行される
    expect(performed).toEqual(['A', 'C']);
  });

  it('keeps only the final state for save A -> save B -> clear -> save C', async () => {
    const performed: string[] = [];
    const enqueue = createCoalescingQueue<{ label: string }>(async (op) => {
      performed.push(op.label);
    });
    await Promise.all([
      enqueue({ label: 'saveA' }),
      enqueue({ label: 'saveB' }),
      enqueue({ label: 'clear' }),
      enqueue({ label: 'saveC' }),
    ]);
    expect(performed).toEqual(['saveA', 'saveC']);
    expect(performed.at(-1)).toBe('saveC');
  });

  it('never overlaps perform (serialized)', async () => {
    let active = 0;
    let maxActive = 0;
    const enqueue = createCoalescingQueue<number>(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
    });
    await Promise.all([enqueue(1), enqueue(2), enqueue(3)]);
    expect(maxActive).toBe(1);
  });

  it('propagates perform errors to the waiting caller', async () => {
    const enqueue = createCoalescingQueue<number>(async (v) => {
      if (v === 1) throw new Error('boom');
    });
    await expect(enqueue(1)).rejects.toThrow('boom');
  });
});
