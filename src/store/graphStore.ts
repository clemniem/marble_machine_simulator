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
  MarbleColor,
  PixelImage,
} from '../simulation/types.js';
import { MARBLE_COLORS } from '../simulation/types.js';
import { DEFAULT_SPAWN_RATE, TICK_RATE } from '../lib/constants.js';
import { createEmptyGrid } from '../simulation/canvas-fill.js';

// ---------------------------------------------------------------------------
// Demo controller code — loaded by the "Demo" button
// ---------------------------------------------------------------------------

const DEMO_CONTROLLER_CODE = `// ── Pixel Painter Controller ──────────────────────────────
// This code runs once per simulation tick. It reads the target
// image, figures out which color the canvas needs next, and
// releases one marble from the correct buffer.
//
// Available API (read-only):
//   api.tick                             – current tick number
//   api.targetImage                      – { width, height, pixels[][] }
//   api.canvasState                      – 2D grid of placed colors (or null)
//   api.getBasinContents(id)             – { color: count } map
//   api.getBufferCount(id)               – marbles held in buffer
//   api.countMarblesHeadingTo(id)        – marbles in transit to a node
//
// Available API (commands):
//   api.extractFromBasin(id, color)      – trigger one extraction now
//   api.releaseBuffer(id, count)         – release N marbles from buffer
//   api.setBasinExtractColor(id, color)  – set basin extraction filter

var BASIN      = 'demo-basin';
var BUF_BLACK  = 'demo-buf-black';
var BUF_WHITE  = 'demo-buf-white';
var CANVAS     = 'demo-canvas';

if (!api.targetImage || !api.canvasState) return;

var W     = api.targetImage.width;
var H     = api.targetImage.height;
var TOTAL = W * H;

// ── Step 1: Count filled cells and marbles already in transit ─
var placed = 0;
for (var r = 0; r < H; r++) {
  for (var c = 0; c < W; c++) {
    if (api.canvasState[r][c] !== null) placed++;
  }
}
if (placed >= TOTAL) return;  // image complete!

// How many marbles are already on their way to the canvas?
// We must not over-release or marbles arrive in wrong color order.
var inTransit   = api.countMarblesHeadingTo(CANVAS);
var dispatched  = placed + inTransit;

if (dispatched >= TOTAL) return;  // all marbles dispatched, just waiting

// ── Step 2: For each un-dispatched cell, release the right color ─
// We can pipeline: release one marble per tick as long as
// dispatched < TOTAL. Marbles arrive in release order because
// all edges have the same traversal time.
var cellIndex  = dispatched;  // next cell that needs a marble
var nextRow    = Math.floor(cellIndex / W);
var nextCol    = cellIndex % W;
var needColor  = api.targetImage.pixels[nextRow][nextCol];

// ── Step 3: Release from the matching buffer ─────────────
var bufId = (needColor === 'black') ? BUF_BLACK : BUF_WHITE;

if (api.getBufferCount(bufId) > 0) {
  api.releaseBuffer(bufId, 1);
}

// ── Step 4: Steer basin extraction to pre-load demand ────
// Look 12 cells ahead and count color needs vs. current stock.
var lookAhead  = Math.min(dispatched + 12, TOTAL);
var needBlack  = 0;
var needWhite  = 0;
for (var i = dispatched; i < lookAhead; i++) {
  var lr = Math.floor(i / W);
  var lc = i % W;
  if (api.targetImage.pixels[lr][lc] === 'black') needBlack++;
  else needWhite++;
}

var stockBlack = api.getBufferCount(BUF_BLACK);
var stockWhite = api.getBufferCount(BUF_WHITE);

if (needBlack > stockBlack) {
  api.setBasinExtractColor(BASIN, 'black');
} else if (needWhite > stockWhite) {
  api.setBasinExtractColor(BASIN, 'white');
} else {
  api.setBasinExtractColor(BASIN, null);  // extract any available
}
`;

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
  targetImage: PixelImage | null;
  controllerCode: string;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  toSimGraph: () => SimGraph;
  validate: () => ValidationResult;
  addNode: (type: SimNodeType, position: { x: number; y: number }) => void;
  setTargetImage: (image: PixelImage | null) => void;
  setControllerCode: (code: string) => void;
  loadDemo: () => void;
  exportJSON: () => string;
  importJSON: (json: string) => string | null;
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
        marbleColor: (rfNode.data?.marbleColor as MarbleColor) ?? 'white',
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
    case 'basin': {
      const emptyContents: Record<MarbleColor, number> = {} as Record<MarbleColor, number>;
      for (const c of MARBLE_COLORS) emptyContents[c] = 0;
      const contents = (rfNode.data?.contents as Record<MarbleColor, number>) ?? emptyContents;
      return {
        ...base,
        type: 'basin',
        contents,
        extractionMode: (rfNode.data?.extractionMode as 'active' | 'passive') ?? 'active',
        extractRate: (rfNode.data?.extractRate as number) ?? 10,
        extractCooldown: (rfNode.data?.extractRate as number) ?? 10,
        extractColor: (rfNode.data?.extractColor as MarbleColor | null) ?? null,
      };
    }
    case 'colorSplitter': {
      const defaultMap: Record<MarbleColor, string> = {} as Record<MarbleColor, string>;
      for (const c of MARBLE_COLORS) defaultMap[c] = `output-${c}`;
      return {
        ...base,
        type: 'colorSplitter',
        outputMap: (rfNode.data?.outputMap as Record<MarbleColor, string>) ?? defaultMap,
      };
    }
    case 'signalBuffer':
      return {
        ...base,
        type: 'signalBuffer',
        heldMarbles: [],
        releaseCount: 0,
        maxCapacity: (rfNode.data?.maxCapacity as number) ?? 50,
      };
    case 'canvas':
      return {
        ...base,
        type: 'canvas',
        width: (rfNode.data?.width as number) ?? 16,
        height: (rfNode.data?.height as number) ?? 16,
        fillPattern: (rfNode.data?.fillPattern as 'left-to-right') ?? 'left-to-right',
        grid: createEmptyGrid(
          (rfNode.data?.width as number) ?? 16,
          (rfNode.data?.height as number) ?? 16,
        ),
        cursor: 0,
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
  targetImage: null,
  controllerCode: '',

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

  setTargetImage: (image) => {
    set({ targetImage: image });
  },

  setControllerCode: (code) => {
    set({ controllerCode: code });
  },

  loadDemo: () => {
    const demoNodes: RFNode[] = [
      {
        id: 'demo-basin', type: 'basin', position: { x: 250, y: 30 },
        data: {
          label: 'basin',
          extractionMode: 'active',
          extractRate: 1,
          contents: {
            red: 0, blue: 0, green: 0, yellow: 0,
            black: 50, white: 50, orange: 0, purple: 0,
          },
        },
      },
      {
        id: 'demo-cs', type: 'colorSplitter', position: { x: 250, y: 180 },
        data: { label: 'colorSplitter' },
      },
      {
        id: 'demo-buf-black', type: 'signalBuffer', position: { x: 80, y: 350 },
        data: { label: 'signalBuffer', maxCapacity: 50 },
      },
      {
        id: 'demo-buf-white', type: 'signalBuffer', position: { x: 420, y: 350 },
        data: { label: 'signalBuffer', maxCapacity: 50 },
      },
      {
        id: 'demo-canvas', type: 'canvas', position: { x: 230, y: 520 },
        data: { label: 'canvas', width: 4, height: 4, fillPattern: 'left-to-right' },
      },
    ];

    const demoEdges: RFEdge[] = [
      { id: 'demo-e1', source: 'demo-basin', target: 'demo-cs', sourceHandle: 'basin-output', targetHandle: 'cs-input' },
      { id: 'demo-e2', source: 'demo-cs', target: 'demo-buf-black', sourceHandle: 'output-black', targetHandle: 'buffer-input' },
      { id: 'demo-e3', source: 'demo-cs', target: 'demo-buf-white', sourceHandle: 'output-white', targetHandle: 'buffer-input' },
      { id: 'demo-e4', source: 'demo-buf-black', target: 'demo-canvas', sourceHandle: 'buffer-output', targetHandle: 'canvas-input' },
      { id: 'demo-e5', source: 'demo-buf-white', target: 'demo-canvas', sourceHandle: 'buffer-output', targetHandle: 'canvas-input' },
    ];

    const checkerboard: MarbleColor[][] = [];
    for (let r = 0; r < 4; r++) {
      const row: MarbleColor[] = [];
      for (let c = 0; c < 4; c++) {
        row.push((r + c) % 2 === 0 ? 'black' : 'white');
      }
      checkerboard.push(row);
    }

    const targetImg: PixelImage = {
      width: 4,
      height: 4,
      palette: [...MARBLE_COLORS],
      pixels: checkerboard,
    };

    const controllerCode = DEMO_CONTROLLER_CODE;

    nodeIdCounter = 100;
    set({
      nodes: demoNodes,
      edges: demoEdges,
      targetImage: targetImg,
      controllerCode,
    });
    saveToStorage(demoNodes, demoEdges);
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
