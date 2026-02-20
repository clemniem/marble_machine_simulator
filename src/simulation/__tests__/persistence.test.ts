import { describe, it, expect } from 'vitest';
import { serializeGraph, deserializeGraph } from '../persistence.js';
import { buildSimGraph, computeEdgeLengths, createNode, createEdge, resetIdCounters } from '../graph.js';
import type { SimNode, SimEdge, SimGraph } from '../types.js';

function makeTestGraph(): SimGraph {
  resetIdCounters();
  const source = createNode('source', { x: 0, y: 0 });
  const splitter = createNode('splitter', { x: 100, y: 100 });
  const sinkA = createNode('sink', { x: 0, y: 200 });
  const sinkB = createNode('sink', { x: 200, y: 200 });

  const e1 = createEdge(source.id, 'output', splitter.id, 'input');
  const e2 = createEdge(splitter.id, 'left', sinkA.id, 'input');
  const e3 = createEdge(splitter.id, 'right', sinkB.id, 'input');

  const nodes: SimNode[] = [source, splitter, sinkA, sinkB];
  const edges: SimEdge[] = [e1, e2, e3];
  return computeEdgeLengths(buildSimGraph(nodes, edges));
}

describe('persistence', () => {
  describe('serializeGraph', () => {
    it('produces valid JSON', () => {
      const graph = makeTestGraph();
      const json = serializeGraph(graph);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('includes version, nodes, and edges', () => {
      const graph = makeTestGraph();
      const json = serializeGraph(graph);
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.nodes).toHaveLength(4);
      expect(parsed.edges).toHaveLength(3);
    });
  });

  describe('deserializeGraph', () => {
    it('round-trips all node data', () => {
      const original = makeTestGraph();
      const json = serializeGraph(original);
      const result = deserializeGraph(json);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.graph.nodes.size).toBe(original.nodes.size);

      for (const [id, node] of original.nodes) {
        const restored = result.graph.nodes.get(id);
        expect(restored).toBeDefined();
        expect(restored!.type).toBe(node.type);
        expect(restored!.position).toEqual(node.position);
      }
    });

    it('round-trips all edge data', () => {
      const original = makeTestGraph();
      const json = serializeGraph(original);
      const result = deserializeGraph(json);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.graph.edges.size).toBe(original.edges.size);

      for (const [id, edge] of original.edges) {
        const restored = result.graph.edges.get(id);
        expect(restored).toBeDefined();
        expect(restored!.from).toBe(edge.from);
        expect(restored!.to).toBe(edge.to);
        expect(restored!.fromHandle).toBe(edge.fromHandle);
        expect(restored!.toHandle).toBe(edge.toHandle);
      }
    });

    it('reconstructs adjacency map', () => {
      const original = makeTestGraph();
      const json = serializeGraph(original);
      const result = deserializeGraph(json);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const [nodeId, edgeIds] of original.adjacency) {
        const restored = result.graph.adjacency.get(nodeId);
        expect(restored).toBeDefined();
        expect(restored!.sort()).toEqual([...edgeIds].sort());
      }
    });

    it('preserves source node properties', () => {
      const original = makeTestGraph();
      const json = serializeGraph(original);
      const result = deserializeGraph(json);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const sources = [...result.graph.nodes.values()].filter((n) => n.type === 'source');
      expect(sources).toHaveLength(1);
      const src = sources[0]!;
      if (src.type !== 'source') return;
      expect(src.spawnRate).toBeGreaterThan(0);
      expect(src.spawnCooldown).toBeGreaterThanOrEqual(0);
    });

    it('preserves splitter ratio', () => {
      const original = makeTestGraph();
      const json = serializeGraph(original);
      const result = deserializeGraph(json);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const splitters = [...result.graph.nodes.values()].filter((n) => n.type === 'splitter');
      expect(splitters).toHaveLength(1);
      if (splitters[0]!.type !== 'splitter') return;
      expect(splitters[0]!.ratio).toBe(0.5);
    });

    it('rejects invalid JSON', () => {
      const result = deserializeGraph('not json at all');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Invalid JSON/);
      }
    });

    it('rejects malformed structure', () => {
      const result = deserializeGraph(JSON.stringify({ version: 1, nodes: 'bad', edges: [] }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Validation failed/);
      }
    });

    it('rejects wrong version', () => {
      const result = deserializeGraph(JSON.stringify({ version: 99, nodes: [], edges: [] }));
      expect(result.ok).toBe(false);
    });

    it('rejects nodes with missing required fields', () => {
      const result = deserializeGraph(
        JSON.stringify({
          version: 1,
          nodes: [{ id: 'x', type: 'source' }], // missing position, spawnRate, spawnCooldown
          edges: [],
        }),
      );
      expect(result.ok).toBe(false);
    });
  });
});
