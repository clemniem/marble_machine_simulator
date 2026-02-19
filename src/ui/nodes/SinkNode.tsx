import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function SinkNode(_props: NodeProps) {
  return (
    <div style={{
      padding: '8px 14px',
      borderRadius: 8,
      background: '#ef4444',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 80,
      textAlign: 'center',
      border: '2px solid #dc2626',
    }}>
      <Handle type="target" position={Position.Top} id="sink-input" />
      Sink
    </div>
  );
}
