import { useState, useCallback } from 'react';
import { useGraphStore } from '../../store/graphStore.js';
import { useSimulationStore } from '../../store/simulationStore.js';

const DEFAULT_CODE = `// Controller code runs once per tick.
// Use the 'api' object to read state and issue commands.
//
// api.tick              - current tick number
// api.targetImage       - the target pixel image (or null)
// api.canvasState       - current canvas grid state
// api.getBasinContents(nodeId)  - marble counts by color
// api.getBufferCount(nodeId)    - marbles held in buffer
// api.extractFromBasin(nodeId, color) - trigger extraction
// api.releaseBuffer(nodeId, count)    - release marbles
// api.setBasinExtractColor(nodeId, color) - set extract color
`;

export default function CodeEditor() {
  const controllerCode = useGraphStore((s) => s.controllerCode);
  const setControllerCode = useGraphStore((s) => s.setControllerCode);
  const controllerError = useSimulationStore((s) => s.simState?.controllerError ?? null);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setControllerCode(e.target.value);
  }, [setControllerCode]);

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb',
      background: '#1e1b4b',
      color: '#e2e8f0',
      fontSize: 12,
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '6px 12px',
          background: 'none',
          border: 'none',
          color: '#e2e8f0',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'monospace',
        }}
      >
        {isOpen ? '▼' : '▶'} Controller Code
        {controllerError && <span style={{ color: '#ef4444', marginLeft: 8 }}>Error</span>}
      </button>
      {isOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          <textarea
            value={controllerCode || DEFAULT_CODE}
            onChange={handleChange}
            spellCheck={false}
            style={{
              width: '100%',
              height: 200,
              background: '#0f172a',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 4,
              padding: 8,
              fontFamily: 'monospace',
              fontSize: 12,
              resize: 'vertical',
              lineHeight: 1.5,
            }}
          />
          {controllerError && (
            <div style={{
              marginTop: 4,
              padding: '4px 8px',
              background: '#7f1d1d',
              borderRadius: 4,
              color: '#fca5a5',
              fontSize: 11,
            }}>
              {controllerError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
