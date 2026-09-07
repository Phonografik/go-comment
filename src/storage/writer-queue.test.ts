import { describe, expect, it } from 'vitest';
import { WriterQueue } from './writer-queue';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('WriterQueue', () => {
  it('runs tasks one at a time, in arrival order, even when the first is slowest', async () => {
    const q = new WriterQueue();
    const order: string[] = [];
    const a = q.run(async () => {
      await sleep(20);
      order.push('a');
      return 'A';
    });
    const b = q.run(async () => {
      order.push('b');
      return 'B';
    });
    const c = q.run(async () => {
      order.push('c');
      return 'C';
    });
    expect(await Promise.all([a, b, c])).toEqual(['A', 'B', 'C']);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('a rejected task surfaces to its caller and does not block the next one', async () => {
    const q = new WriterQueue();
    const failing = q.run(async () => {
      throw new Error('boom');
    });
    const next = q.run(async () => 'still runs');
    await expect(failing).rejects.toThrow('boom');
    expect(await next).toBe('still runs');
  });

  it('a read-modify-write through the queue never loses an update', async () => {
    const q = new WriterQueue();
    let stored: number[] = [];
    const append = (n: number) =>
      q.run(async () => {
        const current = stored; // "read"
        await sleep(1); // the storage round-trip
        stored = [...current, n]; // "write"
      });
    await Promise.all(Array.from({ length: 25 }, (_, i) => append(i)));
    expect(stored).toHaveLength(25);
  });
});
