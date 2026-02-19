import { useSimulationStore } from '../../store/simulationStore.js';
import type { SimNode } from '../../simulation/types.js';

/**
 * Look up a node's live simulation data by its RF node id.
 * Returns undefined when the simulation isn't running.
 */
export function useSimNode<T extends SimNode = SimNode>(id: string): T | undefined {
  return useSimulationStore((s) => s.simState?.graph.nodes.get(id) as T | undefined);
}

/** True when the simulation status is 'running'. */
export function useIsRunning(): boolean {
  return useSimulationStore((s) => s.status === 'running');
}
