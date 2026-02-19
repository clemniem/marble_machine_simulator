import { describe, it, expect } from 'vitest';
import { lerp, clamp, distance } from '../math.js';

describe('lerp', () => {
  it('returns a when t = 0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns b when t = 1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint when t = 0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('works with negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });

  it('extrapolates beyond [0, 1]', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
  });
});

describe('clamp', () => {
  it('returns val when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('works when val equals boundary', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('works with negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

describe('distance', () => {
  it('returns 0 for identical points', () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('computes horizontal distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });

  it('computes vertical distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4);
  });

  it('computes 3-4-5 triangle', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is symmetric', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    expect(distance(a, b)).toBe(distance(b, a));
  });
});
