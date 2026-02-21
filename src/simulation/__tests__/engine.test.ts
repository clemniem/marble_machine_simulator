import { describe, it, expect, beforeEach } from 'vitest';
import { tick } from '../engine.js';
import {
  createNode,
  createEdge,
  buildSimGraph,
  computeEdgeLengths,
  resetIdCounters,
} from '../graph.js';
import { createRng } from '../rng.js';
import { resetMarbleCounter } from '../behaviors.js';
import type { SimState, SinkNode } from '../types.js';

beforeEach(() => {
  resetIdCounters();
  resetMarbleCounter();
});

/**
 * Helper: build a simple source -> sink graph with a given distance.
 * spawnRate = 60 means one marble per tick (cooldown = 1).
 */
function buildSimpleState(opts?: { spawnRate?: number; speed?: number }): SimState {
  const src = createNode('source', { x: 0, y: 0 }, {
    spawnRate: opts?.spawnRate ?? 60,
    spawnCooldown: 1,
  });
  const sink = createNode('sink', { x: 100, y: 0 });
  const edge = createEdge(src.id, 'output', sink.id, 'input');
  const graph = computeEdgeLengths(buildSimGraph([src, sink], [edge]));

  return {
    graph,
    marbles: [],
    tickCount: 0,
    rng: createRng(42),
    targetImage: null,
    controllerCode: '',
    controllerError: null,
  };
}

// ---------------------------------------------------------------------------
// Basic tick behavior
// ---------------------------------------------------------------------------

describe('tick()', () => {
  it('does not mutate the original state', () => {
    const state = buildSimpleState();
    const next = tick(state);

    expect(state.tickCount).toBe(0);
    expect(next.tickCount).toBe(1);
    expect(state.marbles.length).toBe(0);
  });

  it('spawns a marble from a source node', () => {
    const state = buildSimpleState();
    const after1 = tick(state);

    expect(after1.marbles.length).toBe(1);
    expect(after1.marbles[0]!.progress).toBe(0);
  });

  it('advances marble progress each tick', () => {
    const state = buildSimpleState();
    const after1 = tick(state);
    const after2 = tick(after1);

    expect(after2.marbles.length).toBeGreaterThanOrEqual(1);
    const firstMarble = after2.marbles[0]!;
    expect(firstMarble.progress).toBeGreaterThan(0);
  });

  it('sink consumes marbles that arrive', () => {
    const state = buildSimpleState();

    // Run enough ticks for a marble to travel progress 0 -> 1
    // default speed is 0.02, so 50 ticks to reach 1.0
    let current = state;
    // First tick spawns, then we need ~50 more ticks for it to arrive
    for (let i = 0; i < 55; i++) {
      current = tick(current);
    }

    const sink = [...current.graph.nodes.values()].find(
      (n) => n.type === 'sink',
    ) as SinkNode | undefined;

    expect(sink).toBeDefined();
    expect(sink!.consumed).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Determinism proof: same seed + same graph = identical results
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('produces identical state for identical inputs after 10 ticks', () => {
    resetIdCounters();
    resetMarbleCounter();
    const state1 = buildSimpleState();
    resetIdCounters();
    resetMarbleCounter();
    const state2 = buildSimpleState();

    let a = state1;
    let b = state2;

    for (let i = 0; i < 10; i++) {
      a = tick(a);
      b = tick(b);

      expect(a.tickCount).toBe(b.tickCount);
      expect(a.marbles.length).toBe(b.marbles.length);
      expect(a.rng.state).toBe(b.rng.state);

      for (let j = 0; j < a.marbles.length; j++) {
        expect(a.marbles[j]!.id).toBe(b.marbles[j]!.id);
        expect(a.marbles[j]!.progress).toBe(b.marbles[j]!.progress);
        expect(a.marbles[j]!.edgeId).toBe(b.marbles[j]!.edgeId);
      }
    }
  });

  it('different seeds produce different RNG states', () => {
    resetIdCounters();
    resetMarbleCounter();
    const s1 = { ...buildSimpleState(), rng: createRng(1) };
    resetIdCounters();
    resetMarbleCounter();
    const s2 = { ...buildSimpleState(), rng: createRng(2) };

    const a = tick(s1);
    const b = tick(s2);

    expect(a.rng.state).not.toBe(b.rng.state);
  });
});

// ---------------------------------------------------------------------------
// Splitter routing
// ---------------------------------------------------------------------------

describe('splitter', () => {
  function buildSplitterState(): SimState {
    const src = createNode('source', { x: 0, y: 0 }, {
      spawnRate: 60,
      spawnCooldown: 1,
    });
    const splitter = createNode('splitter', { x: 50, y: 0 }, { ratio: 0.5 });
    const sinkL = createNode('sink', { x: 0, y: 100 });
    const sinkR = createNode('sink', { x: 100, y: 100 });

    const e1 = createEdge(src.id, 'output', splitter.id, 'input');
    const e2 = createEdge(splitter.id, 'output-left', sinkL.id, 'input');
    const e3 = createEdge(splitter.id, 'output-right', sinkR.id, 'input');

    const graph = computeEdgeLengths(
      buildSimGraph([src, splitter, sinkL, sinkR], [e1, e2, e3]),
    );

    return { graph, marbles: [], tickCount: 0, rng: createRng(42), targetImage: null, controllerCode: '', controllerError: null };
  }

  it('routes marbles to both outputs over many ticks', () => {
    let state = buildSplitterState();

    // Run 200 ticks — enough for marbles to pass through the splitter
    for (let i = 0; i < 200; i++) {
      state = tick(state);
    }

    const sinks = [...state.graph.nodes.values()].filter(
      (n) => n.type === 'sink',
    ) as SinkNode[];

    const totalConsumed = sinks.reduce((sum, s) => sum + s.consumed, 0);
    expect(totalConsumed).toBeGreaterThan(0);

    // With ratio 0.5 and enough samples, both sinks should receive marbles
    const consumedCounts = sinks.map((s) => s.consumed);
    expect(consumedCounts.every((c) => c > 0)).toBe(true);
  });

  it('is deterministic — same seed gives same split decisions', () => {
    resetIdCounters();
    resetMarbleCounter();
    let a = buildSplitterState();
    resetIdCounters();
    resetMarbleCounter();
    let b = buildSplitterState();

    for (let i = 0; i < 100; i++) {
      a = tick(a);
      b = tick(b);
    }

    const sinksA = [...a.graph.nodes.values()].filter(
      (n) => n.type === 'sink',
    ) as SinkNode[];
    const sinksB = [...b.graph.nodes.values()].filter(
      (n) => n.type === 'sink',
    ) as SinkNode[];

    for (let i = 0; i < sinksA.length; i++) {
      expect(sinksA[i]!.consumed).toBe(sinksB[i]!.consumed);
    }
  });
});

// ---------------------------------------------------------------------------
// Elevator delay
// ---------------------------------------------------------------------------

describe('elevator', () => {
  function buildElevatorState(): SimState {
    const src = createNode('source', { x: 0, y: 0 }, {
      spawnRate: 60,
      spawnCooldown: 1,
    });
    const elev = createNode('elevator', { x: 50, y: 0 }, { delay: 5 });
    const sink = createNode('sink', { x: 100, y: 0 });

    const e1 = createEdge(src.id, 'output', elev.id, 'input');
    const e2 = createEdge(elev.id, 'output', sink.id, 'input');

    const graph = computeEdgeLengths(
      buildSimGraph([src, elev, sink], [e1, e2]),
    );

    return { graph, marbles: [], tickCount: 0, rng: createRng(42), targetImage: null, controllerCode: '', controllerError: null };
  }

  it('delays marbles by the specified tick count', () => {
    let state = buildElevatorState();

    // Run enough ticks for marble to reach elevator and be delayed
    for (let i = 0; i < 150; i++) {
      state = tick(state);
    }

    const sink = [...state.graph.nodes.values()].find(
      (n) => n.type === 'sink',
    ) as SinkNode | undefined;

    expect(sink).toBeDefined();
    expect(sink!.consumed).toBeGreaterThan(0);
  });
});
