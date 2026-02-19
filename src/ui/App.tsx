import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore.js';
import { useSimulationStore } from '../store/simulationStore.js';

/**
 * Minimal app shell for M3 verification.
 * Seeds a hardcoded source -> sink graph and exposes
 * play/pause/step/reset controls to prove the tick loop works.
 */
export default function App() {
  const { nodes, addNode } = useGraphStore();
  const { status, simState, start, pause, step, reset } = useSimulationStore();

  useEffect(() => {
    if (nodes.length > 0) return;
    // Seed a hardcoded graph: source -> sink
    const graphStore = useGraphStore.getState();
    graphStore.addNode('source', { x: 0, y: 0 });
    graphStore.addNode('sink', { x: 200, y: 0 });

    const currentNodes = useGraphStore.getState().nodes;
    const srcId = currentNodes[0]?.id;
    const sinkId = currentNodes[1]?.id;
    if (srcId && sinkId) {
      useGraphStore.setState((s) => ({
        edges: [
          ...s.edges,
          {
            id: 'edge-init',
            source: srcId,
            target: sinkId,
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        ],
      }));
    }
  }, [nodes.length, addNode]);

  const marbleCount = simState?.marbles.length ?? 0;
  const tickCount = simState?.tickCount ?? 0;
  const sinkNode = simState
    ? [...simState.graph.nodes.values()].find((n) => n.type === 'sink')
    : null;
  const consumed = sinkNode?.type === 'sink' ? sinkNode.consumed : 0;

  return (
    <div style={{ padding: 24, fontFamily: 'monospace' }}>
      <h1>Marble Machine Simulator</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>Tick: {tickCount} | Marbles: {marbleCount} | Consumed: {consumed}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={start} disabled={status === 'running'}>Play</button>
        <button onClick={pause} disabled={status !== 'running'}>Pause</button>
        <button onClick={step} disabled={status === 'running'}>Step</button>
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
