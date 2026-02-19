/**
 * Deterministic seeded PRNG using the mulberry32 algorithm.
 *
 * Every function is pure — the RNG state is passed in and a new state
 * is returned alongside the result. No Math.random() anywhere.
 * The state is a single number, making it trivially serializable
 * as part of SimState for replay and snapshot/restore.
 */

import type { SeededRNG } from './types.js';

/** Create a new RNG from an integer seed. */
export function createRng(seed: number): SeededRNG {
  return { state: seed | 0 };
}

/**
 * Generate the next float in [0, 1) and return the updated RNG state.
 *
 * Pure function — does not mutate the input.
 * Uses mulberry32: a fast 32-bit PRNG with good statistical properties
 * for non-cryptographic use cases like game simulations.
 */
export function nextFloat(rng: SeededRNG): [number, SeededRNG] {
  let t = (rng.state + 0x6d2b79f5) | 0;
  const nextState: SeededRNG = { state: t };

  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;

  return [value, nextState];
}

/**
 * Generate the next integer in [0, max) and return the updated RNG state.
 * Convenience wrapper around nextFloat.
 */
export function nextInt(rng: SeededRNG, max: number): [number, SeededRNG] {
  const [f, next] = nextFloat(rng);
  return [Math.floor(f * max), next];
}
