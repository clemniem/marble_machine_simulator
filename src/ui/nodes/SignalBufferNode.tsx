import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode } from '../hooks/useSimNode.js';
import type { SignalBufferNode as SignalBufferNodeType } from '../../simulation/types.js';

export default function SignalBufferNode({ id }: NodeProps) {
  const sim = useSimNode<SignalBufferNodeType>(id);
  const held = sim?.heldMarbles.length ?? 0;
  const max = sim?.maxCapacity ?? 50;

  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 8,
      background: '#0d9488',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 90,
      textAlign: 'center',
      border: '2px solid #0f766e',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Top} id="buffer-input" />
      Buffer
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        {held}/{max}
      </div>
      <div style={{
        marginTop: 4, height: 4, background: 'rgba(0,0,0,0.3)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          width: `${max > 0 ? (held / max) * 100 : 0}%`,
          height: '100%',
          background: '#5eead4',
          transition: 'width 0.1s',
        }} />
      </div>
      <Handle type="source" position={Position.Bottom} id="buffer-output" />
    </div>
  );
}
