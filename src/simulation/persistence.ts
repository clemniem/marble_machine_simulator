/**
 * Serialization / deserialization for SimGraph.
 *
 * SimGraph uses Maps internally, which JSON.stringify ignores.
 * This module converts to/from a JSON-safe intermediate format
 * and validates the result with Zod on the way back in.
 */

import type { SimGraph, SimNode, SimEdge } from './types.js';
import { SimNodeSchema, SimEdgeSchema } from './schemas.js';
import { buildSimGraph, computeEdgeLengths } from './graph.js';
import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Serialized format — plain arrays, no Maps
// ---------------------------------------------------------------------------

export interface SerializedGraph {
  version: 1;
  nodes: SimNode[];
  edges: SimEdge[];
}

const SerializedGraphSchema = z.object({
  version: z.literal(1),
  nodes: z.array(SimNodeSchema),
  edges: z.array(SimEdgeSchema),
});

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

export function serializeGraph(graph: SimGraph): string {
  const payload: SerializedGraph = {
    version: 1,
    nodes: [...graph.nodes.values()],
    edges: [...graph.edges.values()],
  };
  return JSON.stringify(payload, null, 2);
}

// ---------------------------------------------------------------------------
// Deserialize
// ---------------------------------------------------------------------------

export type DeserializeError = { ok: false; error: string };
export type DeserializeResult = { ok: true; graph: SimGraph } | DeserializeError;

export function deserializeGraph(json: string): DeserializeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }

  const result = SerializedGraphSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: `Validation failed: ${result.error.message}` };
  }

  const { nodes, edges } = result.data;
  const graph = buildSimGraph(nodes, edges);
  return { ok: true, graph: computeEdgeLengths(graph) };
}
