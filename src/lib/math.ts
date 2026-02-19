/**
 * Pure math utilities shared across simulation and rendering.
 * No side effects, no dependencies.
 */

import type { Position } from '../simulation/types.js';

/** Linear interpolation between a and b by factor t ∈ [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp val to the inclusive range [min, max]. */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/** Euclidean distance between two 2D points. */
export function distance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
