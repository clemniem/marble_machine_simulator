/**
 * Core simulation data structures.
 *
 * Every type here is framework-agnostic — no React, Zustand, or DOM types.
 * Uses discriminated unions so the tick engine can narrow node types via
 * a simple `switch (node.type)` without type assertions.
 */

// ---------------------------------------------------------------------------
// Branded ID aliases — plain strings at runtime, semantic at the type level
// ---------------------------------------------------------------------------

export type NodeId = string;
export type EdgeId = string;
export type MarbleId = string;

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

export interface Position {
  readonly x: number;
  readonly y: number;
}

// ---------------------------------------------------------------------------
// Simulation Node types (discriminated union on `type`)
// ---------------------------------------------------------------------------

export type SimNodeType =
  | 'source'
  | 'sink'
  | 'splitter'
  | 'elevator'
  | 'ramp';

/** Fields shared by every simulation node. */
export interface SimNodeBase {
  readonly id: NodeId;
  readonly type: SimNodeType;
  readonly position: Position;
}

/** Periodically spawns marbles onto its outgoing edge. */
export interface SourceNode extends SimNodeBase {
  readonly type: 'source';
  /** Marbles spawned per second. */
  readonly spawnRate: number;
  /** Ticks remaining until next spawn (decremented each tick). */
  spawnCooldown: number;
}

/** Terminal node — absorbs marbles and counts them. */
export interface SinkNode extends SimNodeBase {
  readonly type: 'sink';
  /** Running total of marbles consumed. */
  consumed: number;
}

/**
 * Routes each arriving marble to one of two output edges.
 * Decision uses the seeded PRNG for determinism.
 */
export interface SplitterNode extends SimNodeBase {
  readonly type: 'splitter';
  /** Probability [0..1] of choosing the "left" output edge. */
  readonly ratio: number;
}

/** Lifts marbles vertically — queues them and releases after a delay. */
export interface ElevatorNode extends SimNodeBase {
  readonly type: 'elevator';
  /** Ticks a marble spends inside the elevator before release. */
  readonly delay: number;
  /** Marbles currently queued: [marbleId, ticksRemaining]. */
  queue: Array<{ marbleId: MarbleId; ticksRemaining: number }>;
}

/** A passive track segment — marbles roll along it affected by gravity. */
export interface RampNode extends SimNodeBase {
  readonly type: 'ramp';
}

/** Discriminated union of all simulation node types. */
export type SimNode =
  | SourceNode
  | SinkNode
  | SplitterNode
  | ElevatorNode
  | RampNode;

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

/** A directed connection between two node handles. */
export interface SimEdge {
  readonly id: EdgeId;
  readonly from: NodeId;
  /** Semantic handle ID on the source node (e.g. 'output-left'). */
  readonly fromHandle: string;
  readonly to: NodeId;
  /** Semantic handle ID on the target node (e.g. 'input-top'). */
  readonly toHandle: string;
  /**
   * Euclidean distance between connected node positions.
   * Used by physics to compute marble travel time.
   */
  length: number;
}

// ---------------------------------------------------------------------------
// Marble
// ---------------------------------------------------------------------------

/**
 * A marble lives "on an edge" with a progress value 0..1.
 * This decouples physics from pixel layout — node positions can move
 * without breaking the simulation; edge lengths simply recompute.
 */
export interface Marble {
  readonly id: MarbleId;
  /** The edge this marble is currently traveling along. */
  edgeId: EdgeId;
  /** 0 = at source node, 1 = arrived at target node. */
  progress: number;
  /** Progress units per tick. */
  speed: number;
}

// ---------------------------------------------------------------------------
// Seeded RNG state
// ---------------------------------------------------------------------------

/**
 * Opaque state for the deterministic PRNG.
 * Stored as a plain number (the seed) so it's trivially serializable.
 */
export interface SeededRNG {
  state: number;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/** Indexed graph structure optimized for tick-time lookups. */
export interface SimGraph {
  readonly nodes: Map<NodeId, SimNode>;
  readonly edges: Map<EdgeId, SimEdge>;
  /** Outgoing edge IDs per node — avoids linear scans during tick. */
  readonly adjacency: Map<NodeId, EdgeId[]>;
}

// ---------------------------------------------------------------------------
// Top-level simulation state
// ---------------------------------------------------------------------------

export interface SimState {
  readonly graph: SimGraph;
  readonly marbles: Marble[];
  tickCount: number;
  rng: SeededRNG;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationSuccess {
  readonly valid: true;
}

export interface ValidationFailure {
  readonly valid: false;
  readonly errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;
