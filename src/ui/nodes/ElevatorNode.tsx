import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function ElevatorNode({ data }: NodeProps) {
  return (
    <div style={{
      padding: '8px 14px',
      borderRadius: 8,
      background: '#3b82f6',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 80,
      textAlign: 'center',
      border: '2px solid #2563eb',
    }}>
      <Handle type="target" position={Position.Bottom} id="elevator-input" />
      Elevator
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        delay: {(data?.delay as number) ?? 30}t
      </div>
      <Handle type="source" position={Position.Top} id="elevator-output" />
    </div>
  );
}
