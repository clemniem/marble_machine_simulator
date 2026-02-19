/**
 * Zustand store for simulation runtime state.
 *
 * Owns the running SimState and exposes lifecycle actions
 * (start, pause, reset, step). The tick loop reads and writes
 * through this store.
 */

import { create } from 'zustand';
import { tick } from '../simulation/engine.js';
import { createRng } from '../simulation/rng.js';
import type { SimState } from '../simulation/types.js';
import { useGraphStore } from './graphStore.js';
import { startTickLoop, stopTickLoop } from './tickLoop.js';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export type SimStatus = 'idle' | 'running' | 'paused';

export interface SimulationState {
  status: SimStatus;
  simState: SimState | null;
  prevState: SimState | null;
  interpolationAlpha: number;
  /** Start or resume the simulation. */
  start: () => void;
  /** Pause without resetting. */
  pause: () => void;
  /** Stop and discard simulation state. */
  reset: () => void;
  /** Advance exactly one tick (for debugging). */
  step: () => void;
  /** Called by the tick loop — not for external use. */
  _tick: () => void;
  /** Called by the tick loop to set interpolation alpha. */
  _setAlpha: (alpha: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initSimState(): SimState {
  const graph = useGraphStore.getState().toSimGraph();
  return {
    graph,
    marbles: [],
    tickCount: 0,
    rng: createRng(42),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSimulationStore = create<SimulationState>((set, get) => ({
  status: 'idle',
  simState: null,
  prevState: null,
  interpolationAlpha: 0,

  start: () => {
    const { status } = get();
    if (status === 'running') return;

    if (status === 'idle' || !get().simState) {
      set({ simState: initSimState(), prevState: null });
    }

    set({ status: 'running' });
    startTickLoop();
  },

  pause: () => {
    set({ status: 'paused' });
    stopTickLoop();
  },

  reset: () => {
    stopTickLoop();
    set({
      status: 'idle',
      simState: null,
      prevState: null,
      interpolationAlpha: 0,
    });
  },

  step: () => {
    const { status } = get();
    if (status === 'running') return;

    let { simState } = get();
    if (!simState) {
      simState = initSimState();
    }

    const prev = simState;
    const next = tick(simState);
    set({ simState: next, prevState: prev, status: 'paused' });
  },

  _tick: () => {
    const { simState } = get();
    if (!simState) return;

    const prev = simState;
    const next = tick(simState);
    set({ simState: next, prevState: prev });
  },

  _setAlpha: (alpha) => {
    set({ interpolationAlpha: alpha });
  },
}));
