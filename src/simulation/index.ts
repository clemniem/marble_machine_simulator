export type {
  NodeId,
  EdgeId,
  MarbleId,
  Position,
  SimNodeType,
  SimNodeBase,
  SourceNode,
  SinkNode,
  SplitterNode,
  ElevatorNode,
  RampNode,
  SimNode,
  SimEdge,
  Marble,
  SeededRNG,
  SimGraph,
  SimState,
  ValidationResult,
  ValidationSuccess,
  ValidationFailure,
} from './types.js';

export { createRng, nextFloat, nextInt } from './rng.js';

export {
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
} from './graph.js';

export { tick } from './engine.js';
export { handlers, resetMarbleCounter } from './behaviors.js';

export {
  serializeGraph,
  deserializeGraph,
  type SerializedGraph,
  type DeserializeResult,
  type DeserializeError,
} from './persistence.js';
