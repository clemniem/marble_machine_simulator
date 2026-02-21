import { useState, useCallback } from 'react';
import { useSimulationStore } from '../../store/simulationStore.js';
import { computeMetrics } from '../../simulation/metrics.js';
import type { SimMetrics } from '../../simulation/types.js';

interface SavedSnapshot {
  label: string;
  metrics: SimMetrics;
}

export default function MetricsDashboard() {
  const simState = useSimulationStore((s) => s.simState);
  const [isOpen, setIsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SavedSnapshot[]>([]);

  const metrics = simState ? computeMetrics(simState) : null;

  const saveSnapshot = useCallback(() => {
    if (!metrics) return;
    const label = `Run ${snapshots.length + 1} (tick ${metrics.totalTicks})`;
    setSnapshots((prev) => [...prev.slice(-4), { label, metrics }]);
  }, [metrics, snapshots.length]);

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb',
      background: '#fff',
      fontSize: 12,
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '6px 12px',
          background: 'none',
          border: 'none',
          color: '#374151',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {isOpen ? '▼' : '▶'} Metrics
      </button>
      {isOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          {metrics ? (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  <MetricRow label="Ticks" value={metrics.totalTicks} />
                  <MetricRow label="Canvas" value={`${Math.round(metrics.canvasCompletion * 100)}%`} />
                  <MetricRow label="Color accuracy" value={`${Math.round(metrics.colorAccuracy * 100)}%`} />
                  <MetricRow label="In transit" value={metrics.marblesInTransit} />
                  <MetricRow label="In basins" value={metrics.marblesInBasins} />
                  <MetricRow label="In buffers" value={metrics.marblesInBuffers} />
                  <MetricRow label="Travel dist" value={Math.round(metrics.totalMarbleDistance)} />
                  <MetricRow label="Modules" value={
                    Object.entries(metrics.moduleCount)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')
                  } />
                </tbody>
              </table>
              <button onClick={saveSnapshot} style={{ marginTop: 8, fontSize: 11 }}>
                Save Snapshot
              </button>
            </div>
          ) : (
            <div style={{ color: '#9ca3af' }}>Run simulation to see metrics</div>
          )}

          {snapshots.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Saved Snapshots</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '2px 4px' }}>Run</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '2px 4px' }}>Ticks</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '2px 4px' }}>Canvas</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '2px 4px' }}>Accuracy</th>
                    <th style={{ textAlign: 'right', borderBottom: '1px solid #e5e7eb', padding: '2px 4px' }}>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: '2px 4px' }}>{s.label}</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px' }}>{s.metrics.totalTicks}</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px' }}>{Math.round(s.metrics.canvasCompletion * 100)}%</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px' }}>{Math.round(s.metrics.colorAccuracy * 100)}%</td>
                      <td style={{ textAlign: 'right', padding: '2px 4px' }}>{Math.round(s.metrics.totalMarbleDistance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => setSnapshots([])} style={{ marginTop: 4, fontSize: 10, opacity: 0.6 }}>
                Clear snapshots
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <td style={{ padding: '2px 0', color: '#6b7280' }}>{label}</td>
      <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 600 }}>{value}</td>
    </tr>
  );
}
