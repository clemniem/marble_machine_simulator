import { ReactFlowProvider } from '@xyflow/react';
import FlowEditor from './editor/FlowEditor.js';
import NodePalette from './editor/NodePalette.js';
import HUD from './hud/HUD.js';
import CodeEditor from './panels/CodeEditor.js';
import PixelEditor from './panels/PixelEditor.js';
import MetricsDashboard from './panels/MetricsDashboard.js';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HUD />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <NodePalette />
          <PixelEditor />
          <MetricsDashboard />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <ReactFlowProvider>
              <FlowEditor />
            </ReactFlowProvider>
          </div>
          <CodeEditor />
        </div>
      </div>
    </div>
  );
}
