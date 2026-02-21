/**
 * Tick engine — the heart of the simulation.
 *
 * A single pure function advances the world by one tick:
 *   tick(state) => nextState
 *
 * Five phases per tick:
 *   1. advanceMarbles — move existing marbles along their edges
 *   2. processArrivals — handle marbles that reached their destination node
 *   3. runController — execute user controller code (commands buffered)
 *   4. spawnMarbles — source nodes emit new marbles on cooldown
 *   5. tickPeriodicNodes — evaluate gate/basin conditions
 */

import type { SimState, Marble, NodeId } from './types.js';
import { handlers } from './behaviors.js';
import { executeController } from './controller.js';
import { MAX_MARBLES } from '../lib/constants.js';

export function tick(state: SimState): SimState {
  const next: SimState = structuredClone(state);
  next.tickCount++;

  advanceMarbles(next);
  processArrivals(next);
  runController(next);
  spawnMarbles(next);
  tickPeriodicNodes(next);

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

const processedNodes = new Set<NodeId>();

function processArrivals(state: SimState): void {
  processedNodes.clear();
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

  for (const [nodeId, arrivals] of arrivalsByNode) {
    const node = state.graph.nodes.get(nodeId);
    if (!node) continue;

    const handler = handlers[node.type];
    handler({ state, arrivals, node });
    processedNodes.add(nodeId);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Execute user controller code
// ---------------------------------------------------------------------------

function runController(state: SimState): void {
  if (!state.controllerCode?.trim()) return;
  executeController(state);
}

// ---------------------------------------------------------------------------
// Phase 4: Source nodes spawn marbles on cooldown
// ---------------------------------------------------------------------------

function spawnMarbles(state: SimState): void {
  if (state.marbles.length >= MAX_MARBLES) return;

  for (const node of state.graph.nodes.values()) {
    if (node.type !== 'source') continue;

    const alreadyProcessed = state.marbles.some((m) => {
      const edge = state.graph.edges.get(m.edgeId);
      return edge && edge.from === node.id && m.progress === 0;
    });

    if (!alreadyProcessed) {
      handlers.source({ state, arrivals: [], node });
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 5: Tick nodes that need per-tick evaluation
// ---------------------------------------------------------------------------

const PERIODIC_TYPES = new Set(['gate', 'basin', 'signalBuffer']);

function tickPeriodicNodes(state: SimState): void {
  for (const node of state.graph.nodes.values()) {
    if (!PERIODIC_TYPES.has(node.type)) continue;
    if (processedNodes.has(node.id)) continue;

    const handler = handlers[node.type];
    handler({ state, arrivals: [], node });
  }
}
