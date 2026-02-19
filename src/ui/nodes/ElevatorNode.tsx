import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode } from '../hooks/useSimNode.js';
import type { ElevatorNode as ElevatorNodeType } from '../../simulation/types.js';

export default function ElevatorNode({ id, data }: NodeProps) {
  const sim = useSimNode<ElevatorNodeType>(id);
  const queueLen = sim?.queue.length ?? 0;

  return (
    <div
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        background: '#3b82f6',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        minWidth: 80,
        textAlign: 'center',
        border: '2px solid #2563eb',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Bottom} id="elevator-input" />
      Elevator
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        delay: {(data?.delay as number) ?? 30}t
      </div>
      <Handle type="source" position={Position.Top} id="elevator-output" />
      {queueLen > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            background: '#facc15',
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
          {queueLen}
        </span>
      )}
    </div>
  );
}
