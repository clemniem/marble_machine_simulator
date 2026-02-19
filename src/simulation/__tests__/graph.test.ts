import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEmptyGraph,
  createNode,
  createEdge,
  buildSimGraph,
  validateDAG,
  computeEdgeLengths,
  addNode,
  removeNode,
  addEdge,
  removeEdge,
  resetIdCounters,
} from '../graph.js';
import type { SimGraph, ValidationFailure } from '../types.js';

beforeEach(() => {
  resetIdCounters();
});

// ---------------------------------------------------------------------------
// buildSimGraph
// ---------------------------------------------------------------------------

describe('buildSimGraph', () => {
  it('builds indexed graph from arrays', () => {
    const src = createNode('source', { x: 0, y: 0 });
    const sink = createNode('sink', { x: 100, y: 0 });
    const edge = createEdge(src.id, 'output', sink.id, 'input');

    const graph = buildSimGraph([src, sink], [edge]);

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.size).toBe(1);
    expect(graph.adjacency.get(src.id)).toEqual([edge.id]);
    expect(graph.adjacency.get(sink.id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateDAG
// ---------------------------------------------------------------------------

describe('validateDAG', () => {
  it('accepts a valid DAG', () => {
    const src = createNode('source', { x: 0, y: 0 });
    const sink = createNode('sink', { x: 100, y: 0 });
    const edge = createEdge(src.id, 'output', sink.id, 'input');
    const graph = buildSimGraph([src, sink], [edge]);

    expect(validateDAG(graph)).toEqual({ valid: true });
  });

  it('rejects a graph with a cycle', () => {
    const a = createNode('ramp', { x: 0, y: 0 });
    const b = createNode('ramp', { x: 100, y: 0 });
    const e1 = createEdge(a.id, 'output', b.id, 'input');
    const e2 = createEdge(b.id, 'output', a.id, 'input');
    const graph = buildSimGraph([a, b], [e1, e2]);

    const result = validateDAG(graph);
    expect(result.valid).toBe(false);
    expect((result as ValidationFailure).errors[0]).toContain('Cycle');
  });

  it('accepts an empty graph', () => {
    expect(validateDAG(createEmptyGraph())).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// computeEdgeLengths
// ---------------------------------------------------------------------------

describe('computeEdgeLengths', () => {
  it('computes 3-4-5 triangle distance', () => {
    const src = createNode('source', { x: 0, y: 0 });
    const sink = createNode('sink', { x: 3, y: 4 });
    const edge = createEdge(src.id, 'output', sink.id, 'input');
    const graph = buildSimGraph([src, sink], [edge]);

    const updated = computeEdgeLengths(graph);
    const updatedEdge = [...updated.edges.values()][0]!;
    expect(updatedEdge.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// addNode / removeNode
// ---------------------------------------------------------------------------

describe('addNode', () => {
  it('adds a node without mutating the original', () => {
    const graph = createEmptyGraph();
    const node = createNode('source', { x: 0, y: 0 });
    const next = addNode(graph, node);

    expect(next.nodes.size).toBe(1);
    expect(graph.nodes.size).toBe(0);
    expect(next.adjacency.has(node.id)).toBe(true);
  });
});

describe('removeNode', () => {
  it('removes node and all connected edges', () => {
    const src = createNode('source', { x: 0, y: 0 });
    const mid = createNode('ramp', { x: 50, y: 0 });
    const sink = createNode('sink', { x: 100, y: 0 });
    const e1 = createEdge(src.id, 'output', mid.id, 'input');
    const e2 = createEdge(mid.id, 'output', sink.id, 'input');

    let graph = buildSimGraph([src, mid, sink], [e1, e2]);
    graph = removeNode(graph, mid.id);

    expect(graph.nodes.size).toBe(2);
    expect(graph.edges.size).toBe(0);
    expect(graph.adjacency.has(mid.id)).toBe(false);
    expect(graph.adjacency.get(src.id)).toEqual([]);
  });

  it('does not mutate original graph', () => {
    const node = createNode('sink', { x: 0, y: 0 });
    const original = addNode(createEmptyGraph(), node);
    const removed = removeNode(original, node.id);

    expect(original.nodes.size).toBe(1);
    expect(removed.nodes.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// addEdge / removeEdge
// ---------------------------------------------------------------------------

describe('addEdge', () => {
  it('adds an edge and updates adjacency', () => {
    const src = createNode('source', { x: 0, y: 0 });
    const sink = createNode('sink', { x: 100, y: 0 });
    let graph: SimGraph = buildSimGraph([src, sink], []);
    const edge = createEdge(src.id, 'output', sink.id, 'input');

    const result = addEdge(graph, edge);
    expect('nodes' in result).toBe(true);

    graph = result as SimGraph;
    expect(graph.edges.size).toBe(1);
    expect(graph.adjacency.get(src.id)).toContain(edge.id);
  });

  it('rejects an edge that would create a cycle', () => {
    const a = createNode('ramp', { x: 0, y: 0 });
    const b = createNode('ramp', { x: 100, y: 0 });
    const e1 = createEdge(a.id, 'output', b.id, 'input');
    const graph = buildSimGraph([a, b], [e1]);

    const cycleEdge = createEdge(b.id, 'output', a.id, 'input');
    const result = addEdge(graph, cycleEdge);

    expect('valid' in result).toBe(true);
    expect((result as ValidationFailure).valid).toBe(false);
  });
});

describe('removeEdge', () => {
  it('removes edge and updates adjacency', () => {
    const src = createNode('source', { x: 0, y: 0 });
    const sink = createNode('sink', { x: 100, y: 0 });
    const edge = createEdge(src.id, 'output', sink.id, 'input');
    const graph = buildSimGraph([src, sink], [edge]);

    const next = removeEdge(graph, edge.id);
    expect(next.edges.size).toBe(0);
    expect(next.adjacency.get(src.id)).toEqual([]);
  });

  it('returns same graph for non-existent edge', () => {
    const graph = createEmptyGraph();
    expect(removeEdge(graph, 'nope')).toBe(graph);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: add then remove
// ---------------------------------------------------------------------------

describe('add/remove round-trips', () => {
  it('adding then removing a node returns to original size', () => {
    const node = createNode('ramp', { x: 0, y: 0 });
    const graph = addNode(createEmptyGraph(), node);
    const back = removeNode(graph, node.id);

    expect(back.nodes.size).toBe(0);
    expect(back.adjacency.size).toBe(0);
  });

  it('adding then removing an edge returns to original edge count', () => {
    const src = createNode('source', { x: 0, y: 0 });
    const sink = createNode('sink', { x: 100, y: 0 });
    const base = buildSimGraph([src, sink], []);
    const edge = createEdge(src.id, 'output', sink.id, 'input');

    const withEdge = addEdge(base, edge) as SimGraph;
    const without = removeEdge(withEdge, edge.id);

    expect(without.edges.size).toBe(0);
    expect(without.adjacency.get(src.id)).toEqual([]);
  });
});
