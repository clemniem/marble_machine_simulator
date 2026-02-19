import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function SplitterNode({ data }: NodeProps) {
  const ratio = (data?.ratio as number) ?? 0.5;

  return (
    <div style={{
      padding: '8px 14px',
      borderRadius: 8,
      background: '#a855f7',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 100,
      textAlign: 'center',
      border: '2px solid #9333ea',
    }}>
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
