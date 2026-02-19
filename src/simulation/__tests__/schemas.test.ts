import { describe, it, expect } from 'vitest';
import {
  SourceNodeSchema,
  SinkNodeSchema,
  SplitterNodeSchema,
  ElevatorNodeSchema,
  RampNodeSchema,
  SimNodeSchema,
  SimEdgeSchema,
  MarbleSchema,
} from '../schemas.js';

describe('SimNodeSchema', () => {
  const validSource = {
    id: 'src-1',
    type: 'source' as const,
    position: { x: 0, y: 0 },
    spawnRate: 1,
    spawnCooldown: 60,
  };

  const validSink = {
    id: 'sink-1',
    type: 'sink' as const,
    position: { x: 100, y: 200 },
    consumed: 0,
  };

  const validSplitter = {
    id: 'split-1',
    type: 'splitter' as const,
    position: { x: 50, y: 50 },
    ratio: 0.5,
  };

  const validElevator = {
    id: 'elev-1',
    type: 'elevator' as const,
    position: { x: 10, y: 10 },
    delay: 30,
    queue: [],
  };

  const validRamp = {
    id: 'ramp-1',
    type: 'ramp' as const,
    position: { x: 200, y: 100 },
  };

  it('accepts valid source node', () => {
    expect(SourceNodeSchema.parse(validSource)).toEqual(validSource);
  });

  it('accepts valid sink node', () => {
    expect(SinkNodeSchema.parse(validSink)).toEqual(validSink);
  });

  it('accepts valid splitter node', () => {
    expect(SplitterNodeSchema.parse(validSplitter)).toEqual(validSplitter);
  });

  it('accepts valid elevator node', () => {
    expect(ElevatorNodeSchema.parse(validElevator)).toEqual(validElevator);
  });

  it('accepts valid ramp node', () => {
    expect(RampNodeSchema.parse(validRamp)).toEqual(validRamp);
  });

  it('discriminates via SimNodeSchema', () => {
    expect(SimNodeSchema.parse(validSource)).toEqual(validSource);
    expect(SimNodeSchema.parse(validSink)).toEqual(validSink);
    expect(SimNodeSchema.parse(validSplitter)).toEqual(validSplitter);
  });

  it('rejects node with missing id', () => {
    expect(() => SimNodeSchema.parse({ type: 'source', position: { x: 0, y: 0 }, spawnRate: 1, spawnCooldown: 0 })).toThrow();
  });

  it('rejects splitter ratio out of range', () => {
    expect(() => SplitterNodeSchema.parse({ ...validSplitter, ratio: 1.5 })).toThrow();
    expect(() => SplitterNodeSchema.parse({ ...validSplitter, ratio: -0.1 })).toThrow();
  });

  it('rejects negative spawnRate', () => {
    expect(() => SourceNodeSchema.parse({ ...validSource, spawnRate: -1 })).toThrow();
  });

  it('rejects unknown node type', () => {
    expect(() => SimNodeSchema.parse({ ...validSource, type: 'unknown' })).toThrow();
  });
});

describe('SimEdgeSchema', () => {
  const validEdge = {
    id: 'edge-1',
    from: 'src-1',
    fromHandle: 'output',
    to: 'sink-1',
    toHandle: 'input',
    length: 150,
  };

  it('accepts valid edge', () => {
    expect(SimEdgeSchema.parse(validEdge)).toEqual(validEdge);
  });

  it('rejects negative length', () => {
    expect(() => SimEdgeSchema.parse({ ...validEdge, length: -10 })).toThrow();
  });
});

describe('MarbleSchema', () => {
  const validMarble = {
    id: 'marble-1',
    edgeId: 'edge-1',
    progress: 0.5,
    speed: 0.02,
  };

  it('accepts valid marble', () => {
    expect(MarbleSchema.parse(validMarble)).toEqual(validMarble);
  });

  it('rejects progress out of range', () => {
    expect(() => MarbleSchema.parse({ ...validMarble, progress: 1.5 })).toThrow();
    expect(() => MarbleSchema.parse({ ...validMarble, progress: -0.1 })).toThrow();
  });

  it('rejects non-positive speed', () => {
    expect(() => MarbleSchema.parse({ ...validMarble, speed: 0 })).toThrow();
    expect(() => MarbleSchema.parse({ ...validMarble, speed: -1 })).toThrow();
  });

  it('round-trips through parse', () => {
    const parsed = MarbleSchema.parse(validMarble);
    const reparsed = MarbleSchema.parse(parsed);
    expect(reparsed).toEqual(validMarble);
  });
});
