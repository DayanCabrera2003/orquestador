import { describe, expect, it } from 'vitest';
import { InputQueue } from './inputQueue';

describe('InputQueue', () => {
  it('entrega en orden lo encolado antes y después de empezar a leer', async () => {
    const q = new InputQueue<string>();
    q.push('a');
    const read: string[] = [];
    const done = (async () => {
      for await (const x of q) read.push(x);
    })();
    q.push('b');
    await Promise.resolve();
    q.push('c');
    q.close();
    await done;
    expect(read).toEqual(['a', 'b', 'c']);
  });
});
