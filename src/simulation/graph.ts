/**
 * Graph construction, validation, and immutable mutation.
 *
 * Every function is pure — returns a new SimGraph, never mutates input.
 * The adjacency map is always kept in sync with the edge map.
 */

import { distance } from '../lib/math.js';
import { DEFAULT_SPAWN_RATE, TICK_RATE } from '../lib/constants.js';
import type {
  NodeId,
  EdgeId,
  Position,
  SimNode,
  SimNodeType,
  SimEdge,
  SimGraph,
  ValidationResult,
  MarbleColor,
} from './types.js';
import { MARBLE_COLORS } from './types.js';
import { createEmptyGrid } from './canvas-fill.js';

// ---------------------------------------------------------------------------
// Empty graph
// ---------------------------------------------------------------------------

export function createEmptyGraph(): SimGraph {
  return {
    nodes: new Map(),
    edges: new Map(),
    adjacency: new Map(),
  };
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

let nodeCounter = 0;
let edgeCounter = 0;

function generateNodeId(type: SimNodeType): NodeId {
  return `${type}-${++nodeCounter}`;
}

function generateEdgeId(): EdgeId {
  return `edge-${++edgeCounter}`;
}

/** Reset ID counters — useful in tests to get predictable IDs. */
export function resetIdCounters(): void {
  nodeCounter = 0;
  edgeCounter = 0;
}

/**
 * Factory for simulation nodes with sensible defaults.
 * Override any field via the optional `overrides` param.
 */
export function createNode<T extends SimNodeType>(
  type: T,
  position: Position,
  overrides?: Partial<Extract<SimNode, { type: T }>>,
): Extract<SimNode, { type: T }> {
  const id = generateNodeId(type);

  const emptyContents = (): Record<MarbleColor, number> => {
    const c: Partial<Record<MarbleColor, number>> = {};
    for (const color of MARBLE_COLORS) c[color] = 0;
    return c as Record<MarbleColor, number>;
  };

  const defaultOutputMap = (): Record<MarbleColor, string> => {
    const m: Partial<Record<MarbleColor, string>> = {};
    for (const color of MARBLE_COLORS) m[color] = `output-${color}`;
    return m as Record<MarbleColor, string>;
  };

  const defaults: Record<SimNodeType, () => SimNode> = {
    source: () => ({
      id,
      type: 'source' as const,
      position,
      spawnRate: DEFAULT_SPAWN_RATE,
      spawnCooldown: Math.round(TICK_RATE / DEFAULT_SPAWN_RATE),
      marbleColor: 'white' as const,
    }),
    sink: () => ({
      id,
      type: 'sink' as const,
      position,
      consumed: 0,
    }),
    splitter: () => ({
      id,
      type: 'splitter' as const,
      position,
      ratio: 0.5,
    }),
    elevator: () => ({
      id,
      type: 'elevator' as const,
      position,
      delay: 30,
      queue: [],
    }),
    ramp: () => ({
      id,
      type: 'ramp' as const,
      position,
    }),
    gate: () => ({
      id,
      type: 'gate' as const,
      position,
      condition: { kind: 'tickInterval' as const, period: 60 },
      isOpen: false,
      heldMarbles: [],
    }),
    bucket: () => ({
      id,
      type: 'bucket' as const,
      position,
      capacity: 5,
      currentFill: 0,
      releaseMode: 'all' as const,
    }),
    basin: () => ({
      id,
      type: 'basin' as const,
      position,
      contents: emptyContents(),
      extractionMode: 'active' as const,
      extractRate: 10,
      extractCooldown: 10,
      extractColor: null,
    }),
    colorSplitter: () => ({
      id,
      type: 'colorSplitter' as const,
      position,
      outputMap: defaultOutputMap(),
    }),
    signalBuffer: () => ({
      id,
      type: 'signalBuffer' as const,
      position,
      heldMarbles: [],
      releaseCount: 0,
      maxCapacity: 50,
    }),
    canvas: () => ({
      id,
      type: 'canvas' as const,
      position,
      width: 16,
      height: 16,
      fillPattern: 'left-to-right' as const,
      grid: createEmptyGrid(16, 16),
      cursor: 0,
    }),
  };

  const base = defaults[type]();
  return { ...base, ...overrides } as Extract<SimNode, { type: T }>;
}

/** Create an edge between two node handles with auto-generated ID. */
export function createEdge(
  from: NodeId,
  fromHandle: string,
  to: NodeId,
  toHandle: string,
): SimEdge {
  return {
    id: generateEdgeId(),
    from,
    fromHandle,
    to,
    toHandle,
    length: 0,
  };
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/** Convert raw arrays into an indexed SimGraph with adjacency maps. */
export function buildSimGraph(nodes: SimNode[], edges: SimEdge[]): SimGraph {
  const nodeMap = new Map<NodeId, SimNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const edgeMap = new Map<EdgeId, SimEdge>();
  const adjacency = new Map<NodeId, EdgeId[]>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    edgeMap.set(edge.id, edge);
    const list = adjacency.get(edge.from);
    if (list) {
      list.push(edge.id);
    }
  }

  return { nodes: nodeMap, edges: edgeMap, adjacency };
}

// ---------------------------------------------------------------------------
// Validation — DAG check via Kahn's algorithm
// ---------------------------------------------------------------------------

/** Returns success if graph is a DAG, failure with errors if cycles exist. */
export function validateDAG(graph: SimGraph): ValidationResult {
  const inDegree = new Map<NodeId, number>();
  for (const nodeId of graph.nodes.keys()) {
    inDegree.set(nodeId, 0);
  }

  for (const edge of graph.edges.values()) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: NodeId[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;

    const outgoing = graph.adjacency.get(current) ?? [];
    for (const edgeId of outgoing) {
      const edge = graph.edges.get(edgeId);
      if (!edge) continue;

      const newDegree = (inDegree.get(edge.to) ?? 1) - 1;
      inDegree.set(edge.to, newDegree);
      if (newDegree === 0) {
        queue.push(edge.to);
      }
    }
  }

  if (visited === graph.nodes.size) {
    return { valid: true };
  }

  const cycleNodes = [...inDegree.entries()]
    .filter(([, degree]) => degree > 0)
    .map(([nodeId]) => nodeId);

  return {
    valid: false,
    errors: [`Cycle detected involving nodes: ${cycleNodes.join(', ')}`],
  };
}

// ---------------------------------------------------------------------------
// Compute edge lengths from node positions
// ---------------------------------------------------------------------------

/** Return a new graph with edge lengths computed from node positions. */
export function computeEdgeLengths(graph: SimGraph): SimGraph {
  const newEdges = new Map<EdgeId, SimEdge>();

  for (const [edgeId, edge] of graph.edges) {
    const fromNode = graph.nodes.get(edge.from);
    const toNode = graph.nodes.get(edge.to);

    const len =
      fromNode && toNode
        ? distance(fromNode.position, toNode.position)
        : edge.length;

    newEdges.set(edgeId, { ...edge, length: len });
  }

  return { ...graph, edges: newEdges };
}

// ---------------------------------------------------------------------------
// Immutable mutation functions
// ---------------------------------------------------------------------------

/** Return a new graph with the node added and adjacency initialized. */
export function addNode(graph: SimGraph, node: SimNode): SimGraph {
  const nodes = new Map(graph.nodes);
  nodes.set(node.id, node);

  const adjacency = new Map(graph.adjacency);
  if (!adjacency.has(node.id)) {
    adjacency.set(node.id, []);
  }

  return { ...graph, nodes, adjacency };
}

/**
 * Return a new graph with the node and all its connected edges removed.
 * Both outgoing and incoming edges are cleaned up.
 */
export function removeNode(graph: SimGraph, nodeId: NodeId): SimGraph {
  const nodes = new Map(graph.nodes);
  nodes.delete(nodeId);

  const edgesToRemove = new Set<EdgeId>();
  for (const [edgeId, edge] of graph.edges) {
    if (edge.from === nodeId || edge.to === nodeId) {
      edgesToRemove.add(edgeId);
    }
  }

  const edges = new Map(graph.edges);
  for (const edgeId of edgesToRemove) {
    edges.delete(edgeId);
  }

  const adjacency = new Map<NodeId, EdgeId[]>();
  for (const [nid, edgeIds] of graph.adjacency) {
    if (nid === nodeId) continue;
    adjacency.set(
      nid,
      edgeIds.filter((eid) => !edgesToRemove.has(eid)),
    );
  }

  return { nodes, edges, adjacency };
}

/**
 * Return a new graph with the edge added.
 * Rejects with a ValidationResult error if adding this edge would create a cycle.
 */
export function addEdge(
  graph: SimGraph,
  edge: SimEdge,
): SimGraph | ValidationResult {
  const edges = new Map(graph.edges);
  edges.set(edge.id, edge);

  const adjacency = new Map(graph.adjacency);
  const list = [...(adjacency.get(edge.from) ?? []), edge.id];
  adjacency.set(edge.from, list);

  const candidate: SimGraph = { ...graph, edges, adjacency };

  const validation = validateDAG(candidate);
  if (!validation.valid) {
    return validation;
  }

  return candidate;
}

/** Return a new graph with the edge removed and adjacency updated. */
export function removeEdge(graph: SimGraph, edgeId: EdgeId): SimGraph {
  const edge = graph.edges.get(edgeId);
  if (!edge) return graph;

  const edges = new Map(graph.edges);
  edges.delete(edgeId);

  const adjacency = new Map(graph.adjacency);
  const list = adjacency.get(edge.from);
  if (list) {
    adjacency.set(
      edge.from,
      list.filter((eid) => eid !== edgeId),
    );
  }

  return { ...graph, edges, adjacency };
}
