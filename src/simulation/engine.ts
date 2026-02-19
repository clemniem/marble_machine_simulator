/**
 * Tick engine — the heart of the simulation.
 *
 * A single pure function advances the world by one tick:
 *   tick(state) => nextState
 *
 * Three phases per tick:
 *   1. advanceMarbles — move existing marbles along their edges
 *   2. processArrivals — handle marbles that reached their destination node
 *   3. spawnMarbles — source nodes emit new marbles on cooldown
 *
 * structuredClone ensures immutability: the previous state is preserved
 * for interpolation and the caller never sees mutation.
 */

import type { SimState, Marble, NodeId } from './types.js';
import { handlers } from './behaviors.js';
import { MAX_MARBLES } from '../lib/constants.js';

/**
 * Deep-clone state and advance one tick.
 *
 * Uses structuredClone for guaranteed immutability. Maps survive
 * structured cloning in all modern JS engines.
 */
export function tick(state: SimState): SimState {
  const next: SimState = structuredClone(state);
  next.tickCount++;

  advanceMarbles(next);
  processArrivals(next);
  spawnMarbles(next);

  return next;
}

// ---------------------------------------------------------------------------
// Phase 1: Move marbles forward along their edges
// ---------------------------------------------------------------------------

function advanceMarbles(state: SimState): void {
  for (const marble of state.marbles) {
    marble.progress += marble.speed;
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Process marbles that arrived at their target node
// ---------------------------------------------------------------------------

function processArrivals(state: SimState): void {
  // Collect arrivals grouped by destination node
  const arrivalsByNode = new Map<NodeId, Marble[]>();

  for (const marble of state.marbles) {
    if (marble.progress < 1.0) continue;

    const edge = state.graph.edges.get(marble.edgeId);
    if (!edge) continue;

    const existing = arrivalsByNode.get(edge.to);
    if (existing) {
      existing.push(marble);
    } else {
      arrivalsByNode.set(edge.to, [marble]);
    }
  }

  // Dispatch each group to its node's handler
  for (const [nodeId, arrivals] of arrivalsByNode) {
    const node = state.graph.nodes.get(nodeId);
    if (!node) continue;

    const handler = handlers[node.type];
    handler({ state, arrivals, node });
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Source nodes spawn marbles on cooldown
// ---------------------------------------------------------------------------

function spawnMarbles(state: SimState): void {
  if (state.marbles.length >= MAX_MARBLES) return;

  for (const node of state.graph.nodes.values()) {
    if (node.type !== 'source') continue;

    // handleSource already manages spawn cooldown + marble creation
    // during processArrivals if there are arrivals. For ticks where
    // no marble arrives at the source, we still need to tick its cooldown.
    const alreadyProcessed = state.marbles.some((m) => {
      const edge = state.graph.edges.get(m.edgeId);
      return edge && edge.from === node.id && m.progress === 0;
    });

    if (!alreadyProcessed) {
      handlers.source({ state, arrivals: [], node });
    }
  }
}
