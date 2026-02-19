import { useSimulationStore } from '../../store/simulationStore.js';

export default function HUD() {
  const { status, simState, speedMultiplier, start, pause, step, reset, setSpeed } =
    useSimulationStore();

  const marbleCount = simState?.marbles.length ?? 0;
  const tickCount = simState?.tickCount ?? 0;
  const consumed = simState
    ? [...simState.graph.nodes.values()].reduce(
        (sum, n) => sum + (n.type === 'sink' ? n.consumed : 0),
        0,
      )
    : 0;

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
      </div>
    </div>
  );
}
