import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function RampNode(_props: NodeProps) {
  return (
    <div style={{
      padding: '8px 14px',
      borderRadius: 8,
      background: '#f59e0b',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 80,
      textAlign: 'center',
      border: '2px solid #d97706',
    }}>
      <Handle type="target" position={Position.Top} id="ramp-input" />
      Ramp
      <Handle type="source" position={Position.Bottom} id="ramp-output" />
    </div>
  );
}
