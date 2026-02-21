import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSimNode } from '../hooks/useSimNode.js';
import type { CanvasNode as CanvasNodeType, MarbleColor } from '../../simulation/types.js';

const COLOR_MAP: Record<MarbleColor, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  black: '#1e293b', white: '#f1f5f9', orange: '#f97316', purple: '#a855f7',
};

export default function CanvasNode({ id, data }: NodeProps) {
  const sim = useSimNode<CanvasNodeType>(id);
  const w = sim?.width ?? (data?.width as number) ?? 16;
  const h = sim?.height ?? (data?.height as number) ?? 16;
  const grid = sim?.grid;
  const cursor = sim?.cursor ?? 0;
  const total = w * h;
  const pct = total > 0 ? Math.round((cursor / total) * 100) : 0;

  const cellSize = Math.min(4, Math.floor(120 / Math.max(w, h)));

  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 8,
      background: '#1e1b4b',
      color: '#fff',
      fontSize: 12,
      fontWeight: 600,
      minWidth: 100,
      textAlign: 'center',
      border: '2px solid #312e81',
    }}>
      <Handle type="target" position={Position.Top} id="canvas-input" />
      Canvas {w}×{h}
      <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
        {pct}% filled
      </div>
      {grid && cellSize >= 2 && (
        <div style={{
          marginTop: 4,
          display: 'grid',
          gridTemplateColumns: `repeat(${w}, ${cellSize}px)`,
          gap: 0,
          justifyContent: 'center',
        }}>
          {grid.flat().map((cell, i) => (
            <div key={i} style={{
              width: cellSize,
              height: cellSize,
              background: cell ? COLOR_MAP[cell] : 'rgba(255,255,255,0.1)',
            }} />
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="canvas-output" />
    </div>
  );
}
