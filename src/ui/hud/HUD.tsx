import { useRef } from 'react';
import { useSimulationStore } from '../../store/simulationStore.js';
import { useGraphStore } from '../../store/graphStore.js';

function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HUD() {
  const { status, simState, speedMultiplier, start, pause, step, reset, setSpeed } =
    useSimulationStore();
  const exportJSON = useGraphStore((s) => s.exportJSON);
  const importJSON = useGraphStore((s) => s.importJSON);
  const loadDemo = useGraphStore((s) => s.loadDemo);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const marbleCount = simState?.marbles.length ?? 0;
  const tickCount = simState?.tickCount ?? 0;
  const consumed = simState
    ? [...simState.graph.nodes.values()].reduce(
        (sum, n) => sum + (n.type === 'sink' ? n.consumed : 0),
        0,
      )
    : 0;

  const handleExport = () => {
    downloadFile(exportJSON(), 'marble-machine.json');
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const err = importJSON(text);
      if (err) {
        alert(`Import failed: ${err}`);
      }
      // Reset simulation since the graph changed
      useSimulationStore.getState().reset();
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-imported
    e.target.value = '';
  };

  return (
    <div
      style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
        fontFamily: 'monospace',
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      <strong style={{ fontSize: 15 }}>Marble Machine</strong>
      <span>
        Status: <strong>{status}</strong>
      </span>
      <span>Tick: {tickCount}</span>
      <span>Marbles: {marbleCount}</span>
      <span>Consumed: {consumed}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Speed:
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.1}
            value={speedMultiplier}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <span style={{ minWidth: 32 }}>{speedMultiplier}×</span>
        </label>

        <span style={{ borderLeft: '1px solid #e5e7eb', height: 20 }} />

        <button onClick={start} disabled={status === 'running'}>
          Play
        </button>
        <button onClick={pause} disabled={status !== 'running'}>
          Pause
        </button>
        <button onClick={step} disabled={status === 'running'}>
          Step
        </button>
        <button onClick={reset}>Reset</button>

        <span style={{ borderLeft: '1px solid #e5e7eb', height: 20 }} />

        <button onClick={handleExport}>Export</button>
        <button onClick={handleImport}>Import</button>
        <button onClick={() => { loadDemo(); useSimulationStore.getState().reset(); }} style={{ background: '#6366f1', color: '#fff', border: '1px solid #4f46e5', borderRadius: 4, padding: '4px 8px' }}>
          Demo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
