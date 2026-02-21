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
  BasinNode,
  ColorSplitterNode,
  SignalBufferNode,
  CanvasNode,
  EdgeId,
  MarbleId,
  MarbleColor,
} from './types.js';
import { nextFloat } from './rng.js';
import { DEFAULT_MARBLE_SPEED } from '../lib/constants.js';
import { cursorToGridPosition } from './canvas-fill.js';

// ---------------------------------------------------------------------------
// Context passed to every handler
// ---------------------------------------------------------------------------

export interface TickContext {
  state: SimState;
  arrivals: Marble[];
  node: SimNode;
}

export type NodeHandler = (ctx: TickContext) => void;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  color: MarbleColor = 'white',
): void {
  state.marbles.push({
    id: generateMarbleId(state, nodeId),
    edgeId,
    progress: 0,
    speed: DEFAULT_MARBLE_SPEED,
    color,
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
    spawnMarbleOnEdge(ctx.state, edges[0]!.id, node.id, mutableNode.marbleColor);
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

  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) {
      ctx.state.marbles.splice(idx, 1);
    }
    mutableNode.queue.push({
      marbleId: marble.id,
      ticksRemaining: mutableNode.delay,
      color: marble.color,
    });
  }

  const released: Array<{ id: string; color: MarbleColor }> = [];
  for (const item of mutableNode.queue) {
    item.ticksRemaining--;
    if (item.ticksRemaining <= 0) {
      released.push({ id: item.marbleId, color: item.color });
    }
  }

  mutableNode.queue = mutableNode.queue.filter((item) => item.ticksRemaining > 0);

  if (edges[0]) {
    for (const { id, color } of released) {
      ctx.state.marbles.push({
        id,
        edgeId: edges[0].id,
        progress: 0,
        speed: DEFAULT_MARBLE_SPEED,
        color,
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
      break;
  }

  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) ctx.state.marbles.splice(idx, 1);
    mutableNode.heldMarbles.push({ id: marble.id, color: marble.color });
  }

  if (mutableNode.isOpen && edges[0]) {
    for (const held of mutableNode.heldMarbles) {
      ctx.state.marbles.push({
        id: held.id,
        edgeId: edges[0].id,
        progress: 0,
        speed: DEFAULT_MARBLE_SPEED,
        color: held.color,
      });
    }
    mutableNode.heldMarbles = [];

    if (cond.kind === 'marbleCount') {
      mutableNode.isOpen = false;
    }
  }
}

function handleBucket(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as BucketNode | undefined;
  if (!mutableNode) return;

  const edges = getOutgoingEdges(ctx.state, mutableNode.id);

  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) ctx.state.marbles.splice(idx, 1);
    mutableNode.currentFill++;
  }

  if (mutableNode.currentFill >= mutableNode.capacity && edges[0]) {
    if (mutableNode.releaseMode === 'all') {
      for (let i = 0; i < mutableNode.capacity; i++) {
        spawnMarbleOnEdge(ctx.state, edges[0].id, mutableNode.id);
      }
      mutableNode.currentFill = 0;
    } else {
      const excess = mutableNode.currentFill - mutableNode.capacity;
      for (let i = 0; i < excess; i++) {
        spawnMarbleOnEdge(ctx.state, edges[0].id, mutableNode.id);
      }
      mutableNode.currentFill = mutableNode.capacity;
    }
  }
}

// ---------------------------------------------------------------------------
// New node handlers for pixel machine expansion
// ---------------------------------------------------------------------------

function handleBasin(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as BasinNode | undefined;
  if (!mutableNode) return;

  const edges = getOutgoingEdges(ctx.state, mutableNode.id);

  // Absorb arriving marbles into contents
  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) ctx.state.marbles.splice(idx, 1);
    mutableNode.contents[marble.color] = (mutableNode.contents[marble.color] ?? 0) + 1;
  }

  if (edges.length === 0) return;

  // Extract marbles based on cooldown
  mutableNode.extractCooldown--;
  if (mutableNode.extractCooldown <= 0) {
    mutableNode.extractCooldown = mutableNode.extractRate;

    const targetColor = mutableNode.extractColor;
    let colorToExtract: MarbleColor | null = null;

    if (targetColor && (mutableNode.contents[targetColor] ?? 0) > 0) {
      colorToExtract = targetColor;
    } else if (!targetColor) {
      // Extract any available color
      for (const [c, count] of Object.entries(mutableNode.contents)) {
        if (count > 0) {
          colorToExtract = c as MarbleColor;
          break;
        }
      }
    }

    if (colorToExtract) {
      mutableNode.contents[colorToExtract] = (mutableNode.contents[colorToExtract] ?? 1) - 1;
      spawnMarbleOnEdge(ctx.state, edges[0]!.id, mutableNode.id, colorToExtract);
    }
  }
}

function handleColorSplitter(ctx: TickContext): void {
  const node = ctx.node as ColorSplitterNode;
  const edges = getOutgoingEdges(ctx.state, node.id);

  const edgeByHandle = new Map<string, SimEdge>();
  for (const edge of edges) {
    edgeByHandle.set(edge.fromHandle, edge);
  }

  for (const marble of ctx.arrivals) {
    const handleId = node.outputMap[marble.color];
    const targetEdge = handleId ? edgeByHandle.get(handleId) : undefined;

    if (targetEdge) {
      marble.edgeId = targetEdge.id;
      marble.progress = 0;
    } else {
      // No matching output — marble is dropped (consumed)
      const idx = ctx.state.marbles.indexOf(marble);
      if (idx !== -1) ctx.state.marbles.splice(idx, 1);
    }
  }
}

function handleSignalBuffer(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as SignalBufferNode | undefined;
  if (!mutableNode) return;

  const edges = getOutgoingEdges(ctx.state, mutableNode.id);

  for (const marble of ctx.arrivals) {
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) ctx.state.marbles.splice(idx, 1);
    if (mutableNode.heldMarbles.length < mutableNode.maxCapacity) {
      mutableNode.heldMarbles.push({ id: marble.id, color: marble.color });
    }
  }

  if (mutableNode.releaseCount > 0 && edges[0]) {
    const toRelease = Math.min(mutableNode.releaseCount, mutableNode.heldMarbles.length);
    const released = mutableNode.heldMarbles.splice(0, toRelease);
    for (const held of released) {
      ctx.state.marbles.push({
        id: held.id,
        edgeId: edges[0].id,
        progress: 0,
        speed: DEFAULT_MARBLE_SPEED,
        color: held.color,
      });
    }
    mutableNode.releaseCount = 0;
  }
}

function handleCanvas(ctx: TickContext): void {
  const mutableNode = ctx.state.graph.nodes.get(ctx.node.id) as CanvasNode | undefined;
  if (!mutableNode) return;

  const totalCells = mutableNode.width * mutableNode.height;

  for (const marble of ctx.arrivals) {
    // Remove marble from simulation
    const idx = ctx.state.marbles.indexOf(marble);
    if (idx !== -1) ctx.state.marbles.splice(idx, 1);

    if (mutableNode.cursor >= totalCells) continue;

    const { row, col } = cursorToGridPosition(
      mutableNode.cursor,
      mutableNode.width,
      mutableNode.height,
      mutableNode.fillPattern,
    );

    if (mutableNode.grid[row]) {
      mutableNode.grid[row]![col] = marble.color;
    }
    mutableNode.cursor++;
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
  basin: handleBasin,
  colorSplitter: handleColorSplitter,
  signalBuffer: handleSignalBuffer,
  canvas: handleCanvas,
};
