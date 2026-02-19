import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode } from '../hooks/useSimNode.js';
import type { SinkNode as SinkNodeType } from '../../simulation/types.js';

export default function SinkNode({ id }: NodeProps) {
  const sim = useSimNode<SinkNodeType>(id);
  const consumed = sim?.consumed ?? 0;

  return (
    <div
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        background: '#ef4444',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        minWidth: 80,
        textAlign: 'center',
        border: '2px solid #dc2626',
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} id="sink-input" />
      Sink
      {consumed > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            background: '#1e293b',
            color: '#fff',
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
          {consumed > 99 ? '99+' : consumed}
        </span>
      )}
    </div>
  );
}
