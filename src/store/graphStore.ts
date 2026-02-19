/**
 * Zustand store for the graph editor.
 *
 * Owns the React Flow-compatible node/edge arrays. Every user edit
 * (drag, connect, delete) flows through this store. The `toSimGraph()`
 * method converts RF state into the pure simulation SimGraph format.
 */

import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node as RFNode,
  type Edge as RFEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from '@xyflow/react';
import {
  buildSimGraph,
  computeEdgeLengths,
  validateDAG,
} from '../simulation/graph.js';
import type {
  SimGraph,
  SimNode,
  SimNodeType,
  SimEdge,
  ValidationResult,
} from '../simulation/types.js';
import { DEFAULT_MARBLE_SPEED, DEFAULT_SPAWN_RATE, TICK_RATE } from '../lib/constants.js';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface GraphState {
  nodes: RFNode[];
  edges: RFEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  /** Convert current RF state into a validated SimGraph. */
  toSimGraph: () => SimGraph;
  /** Validate current graph is a DAG. */
  validate: () => ValidationResult;
  /** Add a node of the given type at the given position. */
  addNode: (type: SimNodeType, position: { x: number; y: number }) => void;
}

// ---------------------------------------------------------------------------
// RF node -> SimNode conversion
// ---------------------------------------------------------------------------

let nodeIdCounter = 0;

function rfNodeToSimNode(rfNode: RFNode): SimNode {
  const base = {
    id: rfNode.id,
    position: rfNode.position,
  };

  const type = (rfNode.type ?? 'ramp') as SimNodeType;

  switch (type) {
    case 'source':
      return {
        ...base,
        type: 'source',
        spawnRate: (rfNode.data?.spawnRate as number) ?? DEFAULT_SPAWN_RATE,
        spawnCooldown: Math.round(TICK_RATE / ((rfNode.data?.spawnRate as number) ?? DEFAULT_SPAWN_RATE)),
      };
    case 'sink':
      return { ...base, type: 'sink', consumed: 0 };
    case 'splitter':
      return {
        ...base,
        type: 'splitter',
        ratio: (rfNode.data?.ratio as number) ?? 0.5,
      };
    case 'elevator':
      return {
        ...base,
        type: 'elevator',
        delay: (rfNode.data?.delay as number) ?? 30,
        queue: [],
      };
    case 'ramp':
      return { ...base, type: 'ramp' };
    default:
      return { ...base, type: 'ramp' };
  }
}

function rfEdgeToSimEdge(rfEdge: RFEdge): SimEdge {
  return {
    id: rfEdge.id,
    from: rfEdge.source,
    fromHandle: rfEdge.sourceHandle ?? 'output',
    to: rfEdge.target,
    toHandle: rfEdge.targetHandle ?? 'input',
    length: 0,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
  },

  onConnect: (connection: Connection) => {
    const id = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newEdge: RFEdge = {
      id,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
    };
    set((state) => ({ edges: [...state.edges, newEdge] }));
  },

  toSimGraph: () => {
    const { nodes, edges } = get();
    const simNodes = nodes.map(rfNodeToSimNode);
    const simEdges = edges.map(rfEdgeToSimEdge);
    const graph = buildSimGraph(simNodes, simEdges);
    return computeEdgeLengths(graph);
  },

  validate: () => {
    return validateDAG(get().toSimGraph());
  },

  addNode: (type, position) => {
    const id = `${type}-${++nodeIdCounter}`;
    const newNode: RFNode = {
      id,
      type,
      position,
      data: { label: type },
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
  },
}));
