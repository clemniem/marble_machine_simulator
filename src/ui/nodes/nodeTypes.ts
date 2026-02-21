import type { NodeTypes } from '@xyflow/react';
import SourceNode from './SourceNode.js';
import SinkNode from './SinkNode.js';
import SplitterNode from './SplitterNode.js';
import ElevatorNode from './ElevatorNode.js';
import RampNode from './RampNode.js';
import GateNode from './GateNode.js';
import BucketNode from './BucketNode.js';

export const nodeTypes: NodeTypes = {
  source: SourceNode,
  sink: SinkNode,
  splitter: SplitterNode,
  elevator: ElevatorNode,
  ramp: RampNode,
  gate: GateNode,
  bucket: BucketNode,
};
