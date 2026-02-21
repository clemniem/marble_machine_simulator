import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode } from '../hooks/useSimNode.js';
import type { BasinNode as BasinNodeType, MarbleColor } from '../../simulation/types.js';
import { MARBLE_COLORS } from '../../simulation/types.js';

const COLOR_MAP: Record<MarbleColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  black: '#1e293b', white: '#f1f5f9', orange: '#f97316', purple: '#a855f7',
};

export default function BasinNode({ id }: NodeProps) {
  const sim = useSimNode<BasinNodeType>(id);
  const total = sim
    ? Object.values(sim.contents).reduce((s, n) => s + n, 0)
    : 0;

  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 8,
      background: '#78716c',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 100,
      textAlign: 'center',
      border: '2px solid #57534e',
    }}>
      <Handle type="target" position={Position.Top} id="basin-input" />
      Basin
      <div style={{ fontSize: 10, opacity: 0.8 }}>
        {sim?.extractionMode ?? 'active'} · {total} marbles
      </div>
      {sim && (
        <div style={{ display: 'flex', gap: 1, marginTop: 4, height: 6, borderRadius: 3, overflow: 'hidden' }}>
          {MARBLE_COLORS.map((c) => {
            const count = sim.contents[c] ?? 0;
            if (count === 0) return null;
            return (
              <div key={c} style={{
                flex: count,
                background: COLOR_MAP[c],
                minWidth: 2,
              }} />
            );
          })}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="basin-output" />
    </div>
  );
}
