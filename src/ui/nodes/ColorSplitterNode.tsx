import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MarbleColor } from '../../simulation/types.js';
import { MARBLE_COLORS } from '../../simulation/types.js';

const COLOR_MAP: Record<MarbleColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  black: '#1e293b', white: '#f1f5f9', orange: '#f97316', purple: '#a855f7',
};

export default function ColorSplitterNode({ }: NodeProps) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 8,
      background: '#8b5cf6',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 110,
      textAlign: 'center',
      border: '2px solid #7c3aed',
    }}>
      <Handle type="target" position={Position.Top} id="cs-input" />
      Color Splitter
      <div style={{ display: 'flex', gap: 2, marginTop: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {MARBLE_COLORS.map((c) => (
          <div key={c} style={{ position: 'relative' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: COLOR_MAP[c],
              border: '1px solid rgba(255,255,255,0.5)',
            }} />
            <Handle
              type="source"
              position={Position.Bottom}
              id={`output-${c}`}
              style={{ left: '50%', bottom: -8, width: 6, height: 6, background: COLOR_MAP[c] }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
