/**
 * Metrics computation — pure functions that derive optimization stats from SimState.
 */

import type {
  SimState,
  SimMetrics,
  CanvasNode,
  BasinNode,
  SignalBufferNode,
  MarbleColor,
} from './types.js';

export function computeMetrics(state: SimState): SimMetrics {
  const moduleCount: Record<string, number> = {};
  let marblesInBasins = 0;
  let marblesInBuffers = 0;
  let canvasCompletion = 0;
  let colorAccuracy = 0;

  for (const node of state.graph.nodes.values()) {
    moduleCount[node.type] = (moduleCount[node.type] ?? 0) + 1;

    if (node.type === 'basin') {
      const basin = node as BasinNode;
      for (const count of Object.values(basin.contents)) {
        marblesInBasins += count;
      }
    }

    if (node.type === 'signalBuffer') {
      marblesInBuffers += (node as SignalBufferNode).heldMarbles.length;
    }

    if (node.type === 'canvas') {
      const canvas = node as CanvasNode;
      const totalCells = canvas.width * canvas.height;
      const filledCells = canvas.cursor;
      canvasCompletion = totalCells > 0 ? filledCells / totalCells : 0;

      if (state.targetImage) {
        let correct = 0;
        let checked = 0;
        for (let r = 0; r < canvas.height; r++) {
          for (let c = 0; c < canvas.width; c++) {
            const placed: MarbleColor | null | undefined = canvas.grid[r]?.[c];
            const target: MarbleColor | undefined = state.targetImage.pixels[r]?.[c];
            if (placed != null && target != null) {
              checked++;
              if (placed === target) correct++;
            }
          }
        }
        colorAccuracy = checked > 0 ? correct / checked : 0;
      }
    }
  }

  let totalMarbleDistance = 0;
  for (const marble of state.marbles) {
    const edge = state.graph.edges.get(marble.edgeId);
    if (edge) {
      totalMarbleDistance += marble.progress * edge.length;
    }
  }

  return {
    totalTicks: state.tickCount,
    canvasCompletion,
    moduleCount,
    totalMarbleDistance,
    marblesInTransit: state.marbles.length,
    marblesInBasins,
    marblesInBuffers,
    colorAccuracy,
  };
}
