/**
 * Node behavior registry.
 *
 * Maps each SimNodeType to a handler that processes marbles arriving
 * at that node. Adding a new node type only requires adding a new
 * entry here — engine.ts and tick() never need modification.
 *
 * All handlers operate on the mutable `next` state inside a tick
 * (the structuredClone has already been made by the tick function).
 */

import type {
  SimNode,
  SimNodeType,
  SimState,
  Marble,
  SimEdge,
  SourceNode,
  SinkNode,
  SplitterNode,
  ElevatorNode,
  GateNode,
  BucketNode,
  EdgeId,
  MarbleId,
} from './types.js';
import { nextFloat } from './rng.js';
import { DEFAULT_MARBLE_SPEED } from '../lib/constants.js';

// ---------------------------------------------------------------------------
// Context passed to every handler
// ---------------------------------------------------------------------------

export interface TickContext {
  /** Mutable simulation state (already cloned). */
  state: SimState;
  /** Marbles that arrived at this node (progress >= 1). */
  arrivals: Marble[];
  /** The node being processed. */
  node: SimNode;
}

export type NodeHandler = (ctx: TickContext) => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic marble ID from tick count, node ID, and
 * current marble array length. This avoids a global counter and
 * ensures identical states produce identical IDs.
 */
function generateMarbleId(state: SimState, nodeId: string): MarbleId {
  return `m-${state.tickCount}-${nodeId}-${state.marbles.length}`;
}

/** @deprecated No-op kept for backwards compatibility in tests. */
export function resetMarbleCounter(): void {
  // No-op — marble IDs are now derived from state, not a global counter.
}

function getOutgoingEdges(state: SimState, nodeId: string): SimEdge[] {
  const edgeIds = state.graph.adjacency.get(nodeId) ?? [];
  const edges: SimEdge[] = [];
  for (const eid of edgeIds) {
    const edge = state.graph.edges.get(eid);
    if (edge) edges.push(edge);
  }
  return edges;
}

function spawnMarbleOnEdge(
  state: SimState,
  edgeId: EdgeId,
  nodeId: string,
): void {
  state.marbles.push({
    id: generateMarbleId(state, nodeId),
    edgeId,
    progress: 0,
    speed: DEFAULT_MARBLE_SPEED,
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleSource(ctx: TickContext): void {
  const node = ctx.node as SourceNode;
  const edges = getOutgoingEdges(ctx.state, node.id);
  if (edges.length === 0) return;

  const mutableNode = ctx.state.graph.nodes.get(node.id) as SourceNode | undefined;
  if (!mutableNode) return;

  mutableNode.spawnCooldown--;
  if (mutableNode.spawnCooldown <= 0) {
    spawnMarbleOnEdge(ctx.state, edges[0]!.id, node.id);
    mutableNode.spawnCooldown = Math.round(60 / mutableNode.spawnRate);
  }

  for (const marble of ctx.arrivals) {
    if (edges[0]) {
      marble.edgeId = edges[0].id;
      marble.progress = 0;
    }
  }
}

function handleSink(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as SinkNode | undefined;
  if (!mutableNode) return;

  for (const marble of ctx.arrivals) {
    mutableNode.consumed++;
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) {
      ctx.state.marbles.splice(idx, 1);
    }
  }
}

function handleSplitter(ctx: TickContext): void {
  const node = ctx.node as SplitterNode;
  const edges = getOutgoingEdges(ctx.state, node.id);
  if (edges.length < 2) {
    // If only one outgoing edge, route all marbles there
    for (const marble of ctx.arrivals) {
      if (edges[0]) {
        marble.edgeId = edges[0].id;
        marble.progress = 0;
      }
    }
    return;
  }

  for (const marble of ctx.arrivals) {
    const [roll, nextRng] = nextFloat(ctx.state.rng);
    ctx.state.rng = nextRng;

    const chosenEdge = roll < node.ratio ? edges[0]! : edges[1]!;
    marble.edgeId = chosenEdge.id;
    marble.progress = 0;
  }
}

function handleElevator(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as ElevatorNode | undefined;
  if (!mutableNode) return;

  const edges = getOutgoingEdges(ctx.state, mutableNode.id);

  // Queue arriving marbles
  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) {
      ctx.state.marbles.splice(idx, 1);
    }
    mutableNode.queue.push({
      marbleId: marble.id,
      ticksRemaining: mutableNode.delay,
    });
  }

  // Tick down queued marbles and release when ready
  const released: string[] = [];
  for (const item of mutableNode.queue) {
    item.ticksRemaining--;
    if (item.ticksRemaining <= 0) {
      released.push(item.marbleId);
    }
  }

  mutableNode.queue = mutableNode.queue.filter((item) => item.ticksRemaining > 0);

  if (edges[0]) {
    for (const marbleId of released) {
      ctx.state.marbles.push({
        id: marbleId,
        edgeId: edges[0].id,
        progress: 0,
        speed: DEFAULT_MARBLE_SPEED,
      });
    }
  }
}

function handleRamp(ctx: TickContext): void {
  const edges = getOutgoingEdges(ctx.state, ctx.node.id);
  for (const marble of ctx.arrivals) {
    if (edges[0]) {
      marble.edgeId = edges[0].id;
      marble.progress = 0;
    }
  }
}

function handleGate(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as GateNode | undefined;
  if (!mutableNode) return;

  const edges = getOutgoingEdges(ctx.state, mutableNode.id);
  const cond = mutableNode.condition;

  // Evaluate gate condition each tick
  switch (cond.kind) {
    case 'tickInterval':
      mutableNode.isOpen = (ctx.state.tickCount % cond.period) < (cond.period / 2);
      break;
    case 'marbleCount':
      cond.arrivedCount += ctx.arrivals.length;
      if (cond.arrivedCount >= cond.threshold) {
        mutableNode.isOpen = true;
        cond.arrivedCount = 0;
      }
      break;
    case 'manual':
      // isOpen is only changed externally via the store
      break;
  }

  // Remove arriving marbles from the active list and queue them
  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) ctx.state.marbles.splice(idx, 1);
    mutableNode.heldMarbles.push(marble.id);
  }

  // If open, release all held marbles (FIFO) onto the output edge
  if (mutableNode.isOpen && edges[0]) {
    for (const marbleId of mutableNode.heldMarbles) {
      ctx.state.marbles.push({
        id: marbleId,
        edgeId: edges[0].id,
        progress: 0,
        speed: DEFAULT_MARBLE_SPEED,
      });
    }
    mutableNode.heldMarbles = [];

    // For marbleCount mode, close the gate after release
    if (cond.kind === 'marbleCount') {
      mutableNode.isOpen = false;
    }
  }
}

function handleBucket(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as BucketNode | undefined;
  if (!mutableNode) return;

  const edges = getOutgoingEdges(ctx.state, mutableNode.id);

  // Absorb arriving marbles
  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) ctx.state.marbles.splice(idx, 1);
    mutableNode.currentFill++;
  }

  // Check release condition
  if (mutableNode.currentFill >= mutableNode.capacity && edges[0]) {
    if (mutableNode.releaseMode === 'all') {
      for (let i = 0; i < mutableNode.capacity; i++) {
        spawnMarbleOnEdge(ctx.state, edges[0].id, mutableNode.id);
      }
      mutableNode.currentFill = 0;
    } else {
      // overflow mode: release only the excess
      const excess = mutableNode.currentFill - mutableNode.capacity;
      for (let i = 0; i < excess; i++) {
        spawnMarbleOnEdge(ctx.state, edges[0].id, mutableNode.id);
      }
      mutableNode.currentFill = mutableNode.capacity;
    }
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const handlers: Record<SimNodeType, NodeHandler> = {
  source: handleSource,
  sink: handleSink,
  splitter: handleSplitter,
  elevator: handleElevator,
  ramp: handleRamp,
  gate: handleGate,
  bucket: handleBucket,
};
