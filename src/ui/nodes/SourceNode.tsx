import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode, useIsRunning } from '../hooks/useSimNode.js';
import type { SourceNode as SourceNodeType } from '../../simulation/types.js';

export default function SourceNode({ id, data }: NodeProps) {
  const sim = useSimNode<SourceNodeType>(id);
  const running = useIsRunning();
  const nearSpawn = running && sim !== undefined && sim.spawnCooldown <= 5;

  return (
    <div
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        background: '#22c55e',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        minWidth: 80,
        textAlign: 'center',
        border: '2px solid #16a34a',
        boxShadow: nearSpawn ? '0 0 12px 4px rgba(34,197,94,0.7)' : 'none',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      Source
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        {(data?.spawnRate as number) ?? 1}/s
      </div>
      <Handle type="source" position={Position.Bottom} id="source-output" />
    </div>
  );
}
