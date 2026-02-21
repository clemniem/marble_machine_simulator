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
// Marble colors — fixed palette matching the physical machine's bead set
// ---------------------------------------------------------------------------

export const MARBLE_COLORS = [
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple',
] as const;

export type MarbleColor = (typeof MARBLE_COLORS)[number];

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
  | 'ramp'
  | 'gate'
  | 'bucket'
  | 'basin'
  | 'colorSplitter'
  | 'signalBuffer'
  | 'canvas';

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
  /** Color of marbles this source produces. */
  readonly marbleColor: MarbleColor;
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
  /** Marbles currently queued with color preserved. */
  queue: Array<{ marbleId: MarbleId; ticksRemaining: number; color: MarbleColor }>;
}

/** A passive track segment — marbles roll along it affected by gravity. */
export interface RampNode extends SimNodeBase {
  readonly type: 'ramp';
}

// ---------------------------------------------------------------------------
// Gate — conditional pass/block
// ---------------------------------------------------------------------------

export type GateConditionKind = 'marbleCount' | 'tickInterval' | 'manual';

export interface MarbleCountCondition {
  readonly kind: 'marbleCount';
  readonly threshold: number;
  arrivedCount: number;
}

export interface TickIntervalCondition {
  readonly kind: 'tickInterval';
  readonly period: number;
}

export interface ManualCondition {
  readonly kind: 'manual';
}

export type GateCondition = MarbleCountCondition | TickIntervalCondition | ManualCondition;

/** Marble ID + color pair stored by nodes that hold marbles temporarily. */
export interface HeldMarble {
  readonly id: MarbleId;
  readonly color: MarbleColor;
}

export interface GateNode extends SimNodeBase {
  readonly type: 'gate';
  condition: GateCondition;
  isOpen: boolean;
  heldMarbles: HeldMarble[];
}

// ---------------------------------------------------------------------------
// Bucket — fill-based container
// ---------------------------------------------------------------------------

export type BucketReleaseMode = 'all' | 'overflow';

export interface BucketNode extends SimNodeBase {
  readonly type: 'bucket';
  readonly capacity: number;
  currentFill: number;
  readonly releaseMode: BucketReleaseMode;
}

// ---------------------------------------------------------------------------
// Basin — large container holding colored marbles with extraction
// ---------------------------------------------------------------------------

export type BasinExtractionMode = 'active' | 'passive';

export interface BasinNode extends SimNodeBase {
  readonly type: 'basin';
  contents: Record<MarbleColor, number>;
  readonly extractionMode: BasinExtractionMode;
  readonly extractRate: number;
  extractCooldown: number;
  extractColor: MarbleColor | null;
}

// ---------------------------------------------------------------------------
// Color Splitter — routes marbles by color to N outputs
// ---------------------------------------------------------------------------

export interface ColorSplitterNode extends SimNodeBase {
  readonly type: 'colorSplitter';
  readonly outputMap: Record<MarbleColor, string>;
}

// ---------------------------------------------------------------------------
// Signal Buffer — controller-triggered release
// ---------------------------------------------------------------------------

export interface SignalBufferNode extends SimNodeBase {
  readonly type: 'signalBuffer';
  heldMarbles: HeldMarble[];
  releaseCount: number;
  readonly maxCapacity: number;
}

// ---------------------------------------------------------------------------
// Canvas — 2D pixel grid output
// ---------------------------------------------------------------------------

export type FillPattern = 'left-to-right' | 's-shaped' | 'top-to-bottom' | 'spiral';

export interface CanvasNode extends SimNodeBase {
  readonly type: 'canvas';
  readonly width: number;
  readonly height: number;
  readonly fillPattern: FillPattern;
  grid: (MarbleColor | null)[][];
  cursor: number;
}

/** Discriminated union of all simulation node types. */
export type SimNode =
  | SourceNode
  | SinkNode
  | SplitterNode
  | ElevatorNode
  | RampNode
  | GateNode
  | BucketNode
  | BasinNode
  | ColorSplitterNode
  | SignalBufferNode
  | CanvasNode;

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
  /** Marble color from the fixed palette. */
  readonly color: MarbleColor;
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
// Pixel image — target for the canvas module
// ---------------------------------------------------------------------------

export interface PixelImage {
  readonly width: number;
  readonly height: number;
  readonly palette: MarbleColor[];
  readonly pixels: MarbleColor[][];
}

// ---------------------------------------------------------------------------
// Metrics — optimization tracking
// ---------------------------------------------------------------------------

export interface SimMetrics {
  totalTicks: number;
  canvasCompletion: number;
  moduleCount: Record<string, number>;
  totalMarbleDistance: number;
  marblesInTransit: number;
  marblesInBasins: number;
  marblesInBuffers: number;
  colorAccuracy: number;
}

// ---------------------------------------------------------------------------
// Top-level simulation state
// ---------------------------------------------------------------------------

export interface SimState {
  readonly graph: SimGraph;
  readonly marbles: Marble[];
  tickCount: number;
  rng: SeededRNG;
  targetImage: PixelImage | null;
  controllerCode: string;
  controllerError: string | null;
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
