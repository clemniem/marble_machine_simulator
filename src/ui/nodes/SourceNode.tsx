import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode, useIsRunning } from '../hooks/useSimNode.js';
import type { SourceNode as SourceNodeType, MarbleColor } from '../../simulation/types.js';

const COLOR_MAP: Record<MarbleColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  black: '#1e293b', white: '#f1f5f9', orange: '#f97316', purple: '#a855f7',
};

export default function SourceNode({ id, data }: NodeProps) {
  const sim = useSimNode<SourceNodeType>(id);
  const running = useIsRunning();
  const nearSpawn = running && sim !== undefined && sim.spawnCooldown <= 5;
  const marbleColor = (data?.marbleColor as MarbleColor) ?? 'white';

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
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {(data?.spawnRate as number) ?? 1}/s
        <span style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: COLOR_MAP[marbleColor] ?? '#f1f5f9',
          border: '1px solid rgba(0,0,0,0.3)',
        }} />
      </div>
      <Handle type="source" position={Position.Bottom} id="source-output" />
    </div>
  );
}
