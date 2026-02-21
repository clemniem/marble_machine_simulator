import { describe, it, expect, beforeEach } from 'vitest';
import { tick } from '../engine.js';
import { buildSimGraph, computeEdgeLengths, resetIdCounters } from '../graph.js';
import { createRng } from '../rng.js';
import type { SimState, SimNode, SimEdge, BucketNode, SourceNode, BucketReleaseMode } from '../types.js';

function makeBucketGraph(
  capacity: number,
  releaseMode: BucketReleaseMode = 'all',
): { state: SimState; bucketId: string } {
  resetIdCounters();

  const source: SourceNode = {
    id: 'src',
    type: 'source',
    position: { x: 0, y: 0 },
    spawnRate: 60,
    spawnCooldown: 1,
    marbleColor: 'white',
  };

  const bucket: BucketNode = {
    id: 'bucket',
    type: 'bucket',
    position: { x: 100, y: 0 },
    capacity,
    currentFill: 0,
    releaseMode,
  };

  const sink: SimNode = {
    id: 'sink',
    type: 'sink',
    position: { x: 200, y: 0 },
    consumed: 0,
  };

  const edges: SimEdge[] = [
    { id: 'e1', from: 'src', fromHandle: 'output', to: 'bucket', toHandle: 'input', length: 100 },
    { id: 'e2', from: 'bucket', fromHandle: 'output', to: 'sink', toHandle: 'input', length: 100 },
  ];

  const nodes: SimNode[] = [source, bucket, sink];
  const graph = computeEdgeLengths(buildSimGraph(nodes, edges));

  return {
    state: { graph, marbles: [], tickCount: 0, rng: createRng(42), targetImage: null, controllerCode: '', controllerError: null },
    bucketId: 'bucket',
  };
}

function runTicks(state: SimState, n: number): SimState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = tick(s);
  }
  return s;
}

describe('Bucket node', () => {
  beforeEach(() => resetIdCounters());

  describe('all release mode', () => {
    it('fills up then releases all marbles, resetting to 0', () => {
      const { state, bucketId } = makeBucketGraph(3, 'all');

      // Run enough ticks for multiple fill/release cycles
      const after = runTicks(state, 300);
      const bucket = after.graph.nodes.get(bucketId) as BucketNode;
      const sinkNode = after.graph.nodes.get('sink');

      // Bucket should have released at least one batch
      if (sinkNode?.type === 'sink') {
        expect(sinkNode.consumed).toBeGreaterThan(0);
      }
      // currentFill should be less than capacity (either 0 or accumulating)
      expect(bucket.currentFill).toBeLessThan(bucket.capacity);
    });

    it('resets currentFill to 0 after release', () => {
      const { state, bucketId } = makeBucketGraph(2, 'all');

      // Run until we've had enough marbles arrive to trigger at least one release
      // Marble takes 50 ticks to reach bucket. Then bucket fills at 1/tick.
      let s = state;
      let released = false;

      for (let i = 0; i < 200; i++) {
        s = tick(s);
        const bucket = s.graph.nodes.get(bucketId) as BucketNode;
        if (bucket.currentFill === 0 && i > 55) {
          // Fill was reset to 0 after a release
          released = true;
          break;
        }
      }

      expect(released).toBe(true);
    });
  });

  describe('overflow release mode', () => {
    it('clamps currentFill to capacity, releasing only excess', () => {
      const { state, bucketId } = makeBucketGraph(3, 'overflow');

      // Run enough for marbles to arrive
      const after = runTicks(state, 300);
      const bucket = after.graph.nodes.get(bucketId) as BucketNode;

      // In overflow mode, currentFill stays at capacity once reached
      expect(bucket.currentFill).toBeLessThanOrEqual(bucket.capacity);
    });

    it('allows excess marbles through to sink', () => {
      const { state } = makeBucketGraph(3, 'overflow');

      const after = runTicks(state, 300);
      const sinkNode = after.graph.nodes.get('sink');

      if (sinkNode?.type === 'sink') {
        expect(sinkNode.consumed).toBeGreaterThan(0);
      }
    });
  });

  describe('empty bucket', () => {
    it('does not release when below capacity', () => {
      const { state, bucketId } = makeBucketGraph(100, 'all');

      // Only run 60 ticks — first marble arrives ~tick 51, so at most
      // a handful have arrived. Capacity is 100, so no release.
      const after = runTicks(state, 60);
      const bucket = after.graph.nodes.get(bucketId) as BucketNode;

      expect(bucket.currentFill).toBeLessThan(100);
      // No marbles should have been released to the output edge
      const onE2 = after.marbles.filter((m) => m.edgeId === 'e2');
      expect(onE2.length).toBe(0);
    });
  });

  describe('deterministic IDs', () => {
    it('produces identical marble IDs from identical inputs', () => {
      const g1 = makeBucketGraph(2, 'all');
      const g2 = makeBucketGraph(2, 'all');

      const after1 = runTicks(g1.state, 150);
      const after2 = runTicks(g2.state, 150);

      expect(after1.marbles.length).toBe(after2.marbles.length);
      for (let i = 0; i < after1.marbles.length; i++) {
        expect(after1.marbles[i]!.id).toBe(after2.marbles[i]!.id);
      }
    });
  });
});
