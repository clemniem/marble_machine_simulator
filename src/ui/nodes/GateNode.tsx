import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode } from '../hooks/useSimNode.js';
import { useSimulationStore } from '../../store/simulationStore.js';
import type { GateNode as GateNodeType } from '../../simulation/types.js';

export default function GateNode({ id }: NodeProps) {
  const sim = useSimNode<GateNodeType>(id);
  const isOpen = sim?.isOpen ?? false;
  const heldCount = sim?.heldMarbles.length ?? 0;
  const condKind = sim?.condition.kind ?? 'tickInterval';

  const handleToggle = () => {
    const state = useSimulationStore.getState().simState;
    if (!state) return;
    const node = state.graph.nodes.get(id) as GateNodeType | undefined;
    if (node && node.condition.kind === 'manual') {
      node.isOpen = !node.isOpen;
    }
  };

  return (
    <div
      onClick={condKind === 'manual' ? handleToggle : undefined}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        background: isOpen ? '#10b981' : '#6b7280',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        minWidth: 80,
        textAlign: 'center',
        border: `2px solid ${isOpen ? '#059669' : '#4b5563'}`,
        cursor: condKind === 'manual' ? 'pointer' : 'default',
        transition: 'background 0.15s ease, border-color 0.15s ease',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} id="gate-input" />
      Gate
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        {condKind} · {isOpen ? 'OPEN' : 'CLOSED'}
      </div>
      <Handle type="source" position={Position.Bottom} id="gate-output" />
      {heldCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            background: '#f59e0b',
            color: '#1e293b',
            borderRadius: '50%',
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            border: '2px solid #fff',
          }}
        >
          {heldCount}
        </span>
      )}
    </div>
  );
}
