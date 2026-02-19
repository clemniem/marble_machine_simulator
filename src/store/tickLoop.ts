/**
 * Fixed-timestep tick loop using requestAnimationFrame.
 *
 * Decouples simulation rate from frame rate:
 *   - Simulation always advances at TICK_DT intervals
 *   - Rendering can happen at any frame rate
 *   - interpolationAlpha tells the renderer how far between ticks we are
 *
 * The accumulator pattern prevents spiral-of-death when the tab is
 * backgrounded by capping max accumulated time.
 */

import { TICK_DT, MAX_ACCUMULATOR } from '../lib/constants.js';
import { useSimulationStore } from './simulationStore.js';

let rafId: number | null = null;
let lastTime: number | null = null;
let accumulator = 0;

export function startTickLoop(): void {
  if (rafId !== null) return;
  lastTime = null;
  accumulator = 0;
  rafId = requestAnimationFrame(loop);
}

export function stopTickLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  lastTime = null;
  accumulator = 0;
}

function loop(timestamp: number): void {
  const store = useSimulationStore.getState();

  if (store.status !== 'running') {
    rafId = null;
    return;
  }

  if (lastTime === null) {
    lastTime = timestamp;
    rafId = requestAnimationFrame(loop);
    return;
  }

  const frameTime = Math.min((timestamp - lastTime) / 1000, MAX_ACCUMULATOR);
  lastTime = timestamp;
  accumulator += frameTime;

  while (accumulator >= TICK_DT) {
    store._tick();
    accumulator -= TICK_DT;
  }

  store._setAlpha(accumulator / TICK_DT);

  rafId = requestAnimationFrame(loop);
}
