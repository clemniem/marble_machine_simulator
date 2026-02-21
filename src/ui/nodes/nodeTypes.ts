import type { NodeTypes } from '@xyflow/react';
import SourceNode from './SourceNode.js';
import SinkNode from './SinkNode.js';
import SplitterNode from './SplitterNode.js';
import ElevatorNode from './ElevatorNode.js';
import RampNode from './RampNode.js';
import GateNode from './GateNode.js';
import BucketNode from './BucketNode.js';
import BasinNode from './BasinNode.js';
import ColorSplitterNode from './ColorSplitterNode.js';
import SignalBufferNode from './SignalBufferNode.js';
import CanvasNode from './CanvasNode.js';

export const nodeTypes: NodeTypes = {
  source: SourceNode,
  sink: SinkNode,
  splitter: SplitterNode,
  elevator: ElevatorNode,
  ramp: RampNode,
  gate: GateNode,
  bucket: BucketNode,
  basin: BasinNode,
  colorSplitter: ColorSplitterNode,
  signalBuffer: SignalBufferNode,
  canvas: CanvasNode,
};
