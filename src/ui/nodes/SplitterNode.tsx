import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimulationStore } from '../../store/simulationStore.js';

export default function SplitterNode({ id, data }: NodeProps) {
  const ratio = (data?.ratio as number) ?? 0.5;

  // Count marbles currently on edges leaving this splitter
  const activeCount = useSimulationStore((s) => {
    if (!s.simState) return 0;
    let count = 0;
    for (const marble of s.simState.marbles) {
      const edge = s.simState.graph.edges.get(marble.edgeId);
      if (edge && edge.from === id) count++;
    }
    return count;
  });

  return (
    <div
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        background: '#a855f7',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        minWidth: 100,
        textAlign: 'center',
        border: '2px solid #9333ea',
        boxShadow: activeCount > 0 ? '0 0 10px 3px rgba(168,85,247,0.5)' : 'none',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <Handle type="target" position={Position.Top} id="splitter-input" />
      Splitter
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        L {Math.round(ratio * 100)}% / R {Math.round((1 - ratio) * 100)}%
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="splitter-left"
        style={{ left: '25%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="splitter-right"
        style={{ left: '75%' }}
      />
    </div>
  );
}
