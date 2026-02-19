import { describe, it, expect } from 'vitest';
import { createRng, nextFloat, nextInt } from '../rng.js';

describe('SeededRNG (mulberry32)', () => {
  it('produces identical sequences from the same seed', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    let state1 = rng1;
    let state2 = rng2;
    for (let i = 0; i < 100; i++) {
      const [v1, next1] = nextFloat(state1);
      const [v2, next2] = nextFloat(state2);
      expect(v1).toBe(v2);
      state1 = next1;
      state2 = next2;
    }
  });

  it('produces different sequences for different seeds', () => {
    const [v1] = nextFloat(createRng(1));
    const [v2] = nextFloat(createRng(2));
    expect(v1).not.toBe(v2);
  });

  it('outputs values in [0, 1)', () => {
    let state = createRng(123);
    for (let i = 0; i < 1000; i++) {
      const [value, next] = nextFloat(state);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      state = next;
    }
  });

  it('does not mutate the input state', () => {
    const original = createRng(99);
    const stateBefore = original.state;
    nextFloat(original);
    expect(original.state).toBe(stateBefore);
  });

  it('nextInt returns values in [0, max)', () => {
    let state = createRng(7);
    const max = 5;
    for (let i = 0; i < 200; i++) {
      const [value, next] = nextInt(state, max);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(max);
      expect(Number.isInteger(value)).toBe(true);
      state = next;
    }
  });
});
