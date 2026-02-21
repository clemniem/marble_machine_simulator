/**
 * Zustand store for the graph editor.
 *
 * Owns the React Flow-compatible node/edge arrays. Every user edit
 * (drag, connect, delete) flows through this store. The `toSimGraph()`
 * method converts RF state into the pure simulation SimGraph format.
 *
 * Persistence: auto-saves to localStorage on every edit (debounced).
 * Also exposes `exportJSON()` / `importJSON()` for file-based sharing.
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
  GateCondition,
} from '../simulation/types.js';
import { DEFAULT_MARBLE_SPEED, DEFAULT_SPAWN_RATE, TICK_RATE } from '../lib/constants.js';

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'marble-machine-graph';

interface PersistedGraph {
  version: 1;
  nodes: RFNode[];
  edges: RFEdge[];
}

function saveToStorage(nodes: RFNode[], edges: RFEdge[]): void {
  try {
    const payload: PersistedGraph = { version: 1, nodes, edges };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function loadFromStorage(): { nodes: RFNode[]; edges: RFEdge[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGraph;
    if (parsed.version !== 1 || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    return { nodes: parsed.nodes, edges: parsed.edges };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Debounced auto-save
// ---------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(nodes: RFNode[], edges: RFEdge[]): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToStorage(nodes, edges), 1000);
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface GraphState {
  nodes: RFNode[];
  edges: RFEdge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  toSimGraph: () => SimGraph;
  validate: () => ValidationResult;
  addNode: (type: SimNodeType, position: { x: number; y: number }) => void;
  /** Return the current graph as a JSON string for file download. */
  exportJSON: () => string;
  /** Load a graph from a JSON string. Returns null on success, error message on failure. */
  importJSON: (json: string) => string | null;
  /** Clear localStorage and reset to defaults. */
  clearSaved: () => void;
}

// ---------------------------------------------------------------------------
// RF node -> SimNode conversion
// ---------------------------------------------------------------------------

let nodeIdCounter = 2;

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
    case 'gate': {
      const condition = rfNode.data?.condition;
      return {
        ...base,
        type: 'gate',
        condition: (condition && typeof condition === 'object' && 'kind' in condition)
          ? condition as GateCondition
          : { kind: 'tickInterval' as const, period: 60 },
        isOpen: false,
        heldMarbles: [],
      };
    }
    case 'bucket':
      return {
        ...base,
        type: 'bucket',
        capacity: (rfNode.data?.capacity as number) ?? 5,
        currentFill: 0,
        releaseMode: (rfNode.data?.releaseMode as 'all' | 'overflow') ?? 'all',
      };
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
// Initial state — load from localStorage or use defaults
// ---------------------------------------------------------------------------

const DEFAULT_NODES: RFNode[] = [
  { id: 'source-1', type: 'source', position: { x: 100, y: 200 }, data: { label: 'source' } },
  { id: 'sink-1', type: 'sink', position: { x: 450, y: 200 }, data: { label: 'sink' } },
];

const DEFAULT_EDGES: RFEdge[] = [
  { id: 'edge-default-1', source: 'source-1', target: 'sink-1' },
];

function getInitialState(): { nodes: RFNode[]; edges: RFEdge[] } {
  const saved = loadFromStorage();
  if (saved && saved.nodes.length > 0) {
    // Ensure nodeIdCounter is higher than any existing node IDs
    for (const node of saved.nodes) {
      const match = node.id.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1]!, 10);
        if (num >= nodeIdCounter) nodeIdCounter = num + 1;
      }
    }
    return saved;
  }
  return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
}

const initial = getInitialState();

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: initial.nodes,
  edges: initial.edges,

  onNodesChange: (changes) => {
    set((state) => {
      const nodes = applyNodeChanges(changes, state.nodes);
      debouncedSave(nodes, state.edges);
      return { nodes };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => {
      const edges = applyEdgeChanges(changes, state.edges);
      debouncedSave(state.nodes, edges);
      return { edges };
    });
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
    set((state) => {
      const edges = [...state.edges, newEdge];
      debouncedSave(state.nodes, edges);
      return { edges };
    });
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
    set((state) => {
      const nodes = [...state.nodes, newNode];
      debouncedSave(nodes, state.edges);
      return { nodes };
    });
  },

  exportJSON: () => {
    const { nodes, edges } = get();
    const payload: PersistedGraph = { version: 1, nodes, edges };
    return JSON.stringify(payload, null, 2);
  },

  importJSON: (json: string) => {
    try {
      const parsed = JSON.parse(json) as PersistedGraph;
      if (parsed.version !== 1) return 'Unsupported version';
      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
        return 'Invalid format: expected nodes and edges arrays';
      }

      // Validate that the graph can be built
      const simNodes = parsed.nodes.map(rfNodeToSimNode);
      const simEdges = parsed.edges.map(rfEdgeToSimEdge);
      const graph = buildSimGraph(simNodes, simEdges);
      const validation = validateDAG(graph);
      if (!validation.valid) {
        return `Invalid graph: ${validation.errors.join(', ')}`;
      }

      // Update nodeIdCounter to avoid collisions
      for (const node of parsed.nodes) {
        const match = node.id.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1]!, 10);
          if (num >= nodeIdCounter) nodeIdCounter = num + 1;
        }
      }

      set({ nodes: parsed.nodes, edges: parsed.edges });
      saveToStorage(parsed.nodes, parsed.edges);
      return null;
    } catch (e) {
      return `Parse error: ${(e as Error).message}`;
    }
  },

  clearSaved: () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    nodeIdCounter = 2;
    set({ nodes: DEFAULT_NODES, edges: DEFAULT_EDGES });
  },
}));
