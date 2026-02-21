/**
 * Controller execution — sandboxed user code that orchestrates modules.
 *
 * Runs inside tick() as a pure phase. The user code receives an API object
 * with read-only state accessors and command methods. Commands are applied
 * immediately to the mutable cloned state.
 */

import type {
  SimState,
  MarbleColor,
  BasinNode,
  SignalBufferNode,
  CanvasNode,
  PixelImage,
} from './types.js';

export interface ControllerAPI {
  tick: number;
  targetImage: PixelImage | null;
  canvasState: (MarbleColor | null)[][] | null;
  getBasinContents(nodeId: string): Record<MarbleColor, number> | null;
  getBufferCount(nodeId: string): number;
  countMarblesHeadingTo(nodeId: string): number;
  extractFromBasin(nodeId: string, color: MarbleColor): void;
  releaseBuffer(nodeId: string, count: number): void;
  setBasinExtractColor(nodeId: string, color: MarbleColor | null): void;
}

export function executeController(state: SimState): void {
  const code = state.controllerCode.trim();
  if (!code) return;

  // Find first canvas node for convenience
  let canvasGrid: (MarbleColor | null)[][] | null = null;
  for (const node of state.graph.nodes.values()) {
    if (node.type === 'canvas') {
      canvasGrid = (node as CanvasNode).grid;
      break;
    }
  }

  const api: ControllerAPI = {
    tick: state.tickCount,
    targetImage: state.targetImage,
    canvasState: canvasGrid,

    getBasinContents(nodeId: string) {
      const node = state.graph.nodes.get(nodeId);
      if (!node || node.type !== 'basin') return null;
      return { ...(node as BasinNode).contents };
    },

    getBufferCount(nodeId: string) {
      const node = state.graph.nodes.get(nodeId);
      if (!node || node.type !== 'signalBuffer') return 0;
      return (node as SignalBufferNode).heldMarbles.length;
    },

    countMarblesHeadingTo(nodeId: string) {
      const incomingEdgeIds = new Set<string>();
      for (const edge of state.graph.edges.values()) {
        if (edge.to === nodeId) incomingEdgeIds.add(edge.id);
      }
      let count = 0;
      for (const marble of state.marbles) {
        if (incomingEdgeIds.has(marble.edgeId)) count++;
      }
      return count;
    },

    extractFromBasin(nodeId: string, color: MarbleColor) {
      const node = state.graph.nodes.get(nodeId) as BasinNode | undefined;
      if (!node || node.type !== 'basin') return;
      if ((node.contents[color] ?? 0) > 0) {
        node.extractColor = color;
        node.extractCooldown = 0;
      }
    },

    releaseBuffer(nodeId: string, count: number) {
      const node = state.graph.nodes.get(nodeId) as SignalBufferNode | undefined;
      if (!node || node.type !== 'signalBuffer') return;
      node.releaseCount = Math.max(0, Math.floor(count));
    },

    setBasinExtractColor(nodeId: string, color: MarbleColor | null) {
      const node = state.graph.nodes.get(nodeId) as BasinNode | undefined;
      if (!node || node.type !== 'basin') return;
      node.extractColor = color;
    },
  };

  try {
    const fn = new Function('api', code);
    fn(Object.freeze({ ...api }));
    state.controllerError = null;
  } catch (e) {
    state.controllerError = (e as Error).message;
  }
}
