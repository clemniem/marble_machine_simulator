/**
 * Zod schemas for all simulation types.
 *
 * Used at the UI-to-engine boundary to validate data coming from
 * React Flow before it enters the pure simulation layer.
 * Each schema mirrors a type in types.ts.
 */

import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// ---------------------------------------------------------------------------
// Node schemas (discriminated union on `type`)
// ---------------------------------------------------------------------------

export const SourceNodeSchema = z.object({
  id: z.string(),
  type: z.literal('source'),
  position: PositionSchema,
  spawnRate: z.number().positive(),
  spawnCooldown: z.number().int().nonnegative(),
});

export const SinkNodeSchema = z.object({
  id: z.string(),
  type: z.literal('sink'),
  position: PositionSchema,
  consumed: z.number().int().nonnegative(),
});

export const SplitterNodeSchema = z.object({
  id: z.string(),
  type: z.literal('splitter'),
  position: PositionSchema,
  ratio: z.number().min(0).max(1),
});

const ElevatorQueueItemSchema = z.object({
  marbleId: z.string(),
  ticksRemaining: z.number().int().nonnegative(),
});

export const ElevatorNodeSchema = z.object({
  id: z.string(),
  type: z.literal('elevator'),
  position: PositionSchema,
  delay: z.number().int().positive(),
  queue: z.array(ElevatorQueueItemSchema),
});

export const RampNodeSchema = z.object({
  id: z.string(),
  type: z.literal('ramp'),
  position: PositionSchema,
});

// Gate condition — discriminated union on `kind`
const MarbleCountConditionSchema = z.object({
  kind: z.literal('marbleCount'),
  threshold: z.number().int().positive(),
  arrivedCount: z.number().int().nonnegative(),
});

const TickIntervalConditionSchema = z.object({
  kind: z.literal('tickInterval'),
  period: z.number().int().positive(),
});

const ManualConditionSchema = z.object({
  kind: z.literal('manual'),
});

export const GateConditionSchema = z.discriminatedUnion('kind', [
  MarbleCountConditionSchema,
  TickIntervalConditionSchema,
  ManualConditionSchema,
]);

export const GateNodeSchema = z.object({
  id: z.string(),
  type: z.literal('gate'),
  position: PositionSchema,
  condition: GateConditionSchema,
  isOpen: z.boolean(),
  heldMarbles: z.array(z.string()),
});

export const BucketNodeSchema = z.object({
  id: z.string(),
  type: z.literal('bucket'),
  position: PositionSchema,
  capacity: z.number().int().positive(),
  currentFill: z.number().int().nonnegative(),
  releaseMode: z.union([z.literal('all'), z.literal('overflow')]),
});

export const SimNodeSchema = z.discriminatedUnion('type', [
  SourceNodeSchema,
  SinkNodeSchema,
  SplitterNodeSchema,
  ElevatorNodeSchema,
  RampNodeSchema,
  GateNodeSchema,
  BucketNodeSchema,
]);

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

export const SimEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  fromHandle: z.string(),
  to: z.string(),
  toHandle: z.string(),
  length: z.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// Marble
// ---------------------------------------------------------------------------

export const MarbleSchema = z.object({
  id: z.string(),
  edgeId: z.string(),
  progress: z.number().min(0).max(1),
  speed: z.number().positive(),
});

// ---------------------------------------------------------------------------
// RNG
// ---------------------------------------------------------------------------

export const SeededRNGSchema = z.object({
  state: z.number(),
});

// ---------------------------------------------------------------------------
// Graph — structural validation
// ---------------------------------------------------------------------------

export const SimGraphSchema = z.object({
  nodes: z.map(z.string(), SimNodeSchema),
  edges: z.map(z.string(), SimEdgeSchema),
  adjacency: z.map(z.string(), z.array(z.string())),
});

// ---------------------------------------------------------------------------
// SimState
// ---------------------------------------------------------------------------

export const SimStateSchema = z.object({
  graph: SimGraphSchema,
  marbles: z.array(MarbleSchema),
  tickCount: z.number().int().nonnegative(),
  rng: SeededRNGSchema,
});
