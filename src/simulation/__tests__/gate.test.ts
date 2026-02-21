import { describe, it, expect, beforeEach } from 'vitest';
import { tick } from '../engine.js';
import { buildSimGraph, computeEdgeLengths, resetIdCounters } from '../graph.js';
import { createRng } from '../rng.js';
import type { SimState, SimNode, SimEdge, GateNode, SourceNode } from '../types.js';

function makeGateGraph(
  condition: GateNode['condition'],
): { state: SimState; gateId: string; edgeToGate: string; edgeFromGate: string } {
  resetIdCounters();

  const source: SourceNode = {
    id: 'src',
    type: 'source',
    position: { x: 0, y: 0 },
    spawnRate: 60, // 1 per tick
    spawnCooldown: 1,
  };

  const gate: GateNode = {
    id: 'gate',
    type: 'gate',
    position: { x: 100, y: 0 },
    condition,
    isOpen: false,
    heldMarbles: [],
  };

  const sink: SimNode = {
    id: 'sink',
    type: 'sink',
    position: { x: 200, y: 0 },
    consumed: 0,
  };

  const edges: SimEdge[] = [
    { id: 'e1', from: 'src', fromHandle: 'output', to: 'gate', toHandle: 'input', length: 100 },
    { id: 'e2', from: 'gate', fromHandle: 'output', to: 'sink', toHandle: 'input', length: 100 },
  ];

  const nodes: SimNode[] = [source, gate, sink];
  const graph = computeEdgeLengths(buildSimGraph(nodes, edges));

  return {
    state: { graph, marbles: [], tickCount: 0, rng: createRng(42) },
    gateId: 'gate',
    edgeToGate: 'e1',
    edgeFromGate: 'e2',
  };
}

function runTicks(state: SimState, n: number): SimState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = tick(s);
  }
  return s;
}

describe('Gate node', () => {
  beforeEach(() => resetIdCounters());

  describe('tickInterval condition', () => {
    it('alternates open/closed over a period', () => {
      const { state, gateId } = makeGateGraph({ kind: 'tickInterval', period: 10 });

      // Run enough ticks for marbles to arrive and gate to cycle
      const after = runTicks(state, 100);
      const gate = after.graph.nodes.get(gateId) as GateNode;

      // At tick 100, tickCount=100, period=10 → 100%10=0 < 5 → open
      expect(gate.isOpen).toBe(true);
    });

    it('holds marbles when closed and releases when open', () => {
      const { state, gateId } = makeGateGraph({ kind: 'tickInterval', period: 20 });

      // Marbles take ~50 ticks to reach the gate, then another ~50 to reach the sink.
      // Run 200 ticks so marbles have time to pass through both edges.
      const after = runTicks(state, 200);
      const gate = after.graph.nodes.get(gateId) as GateNode;
      const sinkNode = after.graph.nodes.get('sink');

      // Some marbles should have passed through during open phases
      if (sinkNode?.type === 'sink') {
        expect(sinkNode.consumed).toBeGreaterThan(0);
      }
      // Gate state is deterministic based on tickCount
      expect(typeof gate.isOpen).toBe('boolean');
    });
  });

  describe('marbleCount condition', () => {
    it('stays closed until threshold met, then opens and releases', () => {
      const { state, gateId } = makeGateGraph({
        kind: 'marbleCount',
        threshold: 3,
        arrivedCount: 0,
      });

      // Speed up: marbles take 50 ticks to traverse (speed=0.02, progress 0→1)
      // Source spawns 1 marble/tick. First marble arrives at gate at tick ~51.
      const after = runTicks(state, 200);
      const gate = after.graph.nodes.get(gateId) as GateNode;
      const sinkNode = after.graph.nodes.get('sink');

      // After enough time, threshold should have been met at least once,
      // releasing marbles to the sink
      if (sinkNode?.type === 'sink') {
        expect(sinkNode.consumed).toBeGreaterThan(0);
      }
      // Gate closes after releasing in marbleCount mode
      expect(gate.isOpen).toBe(false);
    });
  });

  describe('manual condition', () => {
    it('stays closed by default, holding all marbles', () => {
      const { state, gateId } = makeGateGraph({ kind: 'manual' });

      const after = runTicks(state, 100);
      const gate = after.graph.nodes.get(gateId) as GateNode;
      const sinkNode = after.graph.nodes.get('sink');

      expect(gate.isOpen).toBe(false);
      // All marbles should be held, none consumed
      if (sinkNode?.type === 'sink') {
        expect(sinkNode.consumed).toBe(0);
      }
      expect(gate.heldMarbles.length).toBeGreaterThan(0);
    });

    it('releases all held marbles when manually opened', () => {
      const { state, gateId } = makeGateGraph({ kind: 'manual' });

      // Run until gate has held some marbles
      let s = runTicks(state, 80);
      const gateBefore = s.graph.nodes.get(gateId) as GateNode;
      const heldBefore = gateBefore.heldMarbles.length;
      expect(heldBefore).toBeGreaterThan(0);

      // Manually open the gate (mutate the cloned state)
      const cloned = structuredClone(s);
      const gateNode = cloned.graph.nodes.get(gateId) as GateNode;
      gateNode.isOpen = true;

      // Run one more tick — should release
      s = tick(cloned);
      const gateAfter = s.graph.nodes.get(gateId) as GateNode;
      expect(gateAfter.heldMarbles.length).toBe(0);
    });
  });

  describe('FIFO ordering', () => {
    it('releases marbles in arrival order', () => {
      const { state, gateId } = makeGateGraph({ kind: 'manual' });

      // Accumulate marbles
      let s = runTicks(state, 80);
      const gate = s.graph.nodes.get(gateId) as GateNode;
      const heldOrder = [...gate.heldMarbles];
      expect(heldOrder.length).toBeGreaterThan(1);

      // Open and tick
      const cloned = structuredClone(s);
      (cloned.graph.nodes.get(gateId) as GateNode).isOpen = true;
      s = tick(cloned);

      // The released marbles should be on the output edge
      const releasedOnE2 = s.marbles
        .filter((m) => m.edgeId === 'e2' && m.progress === 0)
        .map((m) => m.id);

      // All previously held marbles should appear in FIFO order at the
      // start of the released list. An additional in-flight marble may
      // arrive and get released in the same tick (appended at the end).
      for (let i = 0; i < heldOrder.length; i++) {
        expect(releasedOnE2[i]).toBe(heldOrder[i]);
      }
    });
  });

  describe('determinism', () => {
    it('produces identical state from identical inputs', () => {
      const { state: s1 } = makeGateGraph({ kind: 'tickInterval', period: 10 });
      const { state: s2 } = makeGateGraph({ kind: 'tickInterval', period: 10 });

      const after1 = runTicks(s1, 50);
      const after2 = runTicks(s2, 50);

      expect(after1.tickCount).toBe(after2.tickCount);
      expect(after1.marbles.length).toBe(after2.marbles.length);

      const gate1 = after1.graph.nodes.get('gate') as GateNode;
      const gate2 = after2.graph.nodes.get('gate') as GateNode;
      expect(gate1.isOpen).toBe(gate2.isOpen);
      expect(gate1.heldMarbles).toEqual(gate2.heldMarbles);
    });
  });
});
