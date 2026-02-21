import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode } from '../hooks/useSimNode.js';
import type { BucketNode as BucketNodeType } from '../../simulation/types.js';

export default function BucketNode({ id, data }: NodeProps) {
  const sim = useSimNode<BucketNodeType>(id);
  const capacity = sim?.capacity ?? (data?.capacity as number) ?? 5;
  const currentFill = sim?.currentFill ?? 0;
  const fillPct = capacity > 0 ? Math.min(currentFill / capacity, 1) : 0;

  return (
    <div
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        background: '#0ea5e9',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        minWidth: 80,
        textAlign: 'center',
        border: '2px solid #0284c7',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Fill bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: `${fillPct * 100}%`,
          background: 'rgba(255,255,255,0.2)',
          transition: 'height 0.1s ease',
        }}
      />
      <Handle type="target" position={Position.Top} id="bucket-input" />
      <div style={{ position: 'relative' }}>
        Bucket
        <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
          {currentFill} / {capacity}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="bucket-output" />
    </div>
  );
}
