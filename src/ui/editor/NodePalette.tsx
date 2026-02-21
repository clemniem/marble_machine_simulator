import type { DragEvent } from 'react';
import type { SimNodeType } from '../../simulation/types.js';

const NODE_TYPES: Array<{ type: SimNodeType; label: string; color: string }> = [
  { type: 'source', label: 'Source', color: '#22c55e' },
  { type: 'sink', label: 'Sink', color: '#ef4444' },
  { type: 'splitter', label: 'Splitter', color: '#a855f7' },
  { type: 'elevator', label: 'Elevator', color: '#3b82f6' },
  { type: 'ramp', label: 'Ramp', color: '#f59e0b' },
  { type: 'gate', label: 'Gate', color: '#6b7280' },
  { type: 'bucket', label: 'Bucket', color: '#0ea5e9' },
  { type: 'basin', label: 'Basin', color: '#78716c' },
  { type: 'colorSplitter', label: 'Color Split', color: '#8b5cf6' },
  { type: 'signalBuffer', label: 'Buffer', color: '#0d9488' },
  { type: 'canvas', label: 'Canvas', color: '#1e1b4b' },
];

export default function NodePalette() {
  const onDragStart = (event: DragEvent, type: SimNodeType) => {
    event.dataTransfer.setData('application/marble-node-type', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      borderRight: '1px solid #e5e7eb',
      background: '#f9fafb',
      width: 130,
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
        Nodes
      </div>
      {NODE_TYPES.map(({ type, label, color }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: color,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'grab',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
