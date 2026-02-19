import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function SourceNode({ data }: NodeProps) {
  return (
    <div style={{
      padding: '8px 14px',
      borderRadius: 8,
      background: '#22c55e',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 80,
      textAlign: 'center',
      border: '2px solid #16a34a',
    }}>
      Source
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        {(data?.spawnRate as number) ?? 1}/s
      </div>
      <Handle type="source" position={Position.Bottom} id="source-output" />
    </div>
  );
}
