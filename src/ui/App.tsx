import { ReactFlowProvider } from '@xyflow/react';
import FlowEditor from './editor/FlowEditor.js';
import NodePalette from './editor/NodePalette.js';
import HUD from './hud/HUD.js';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HUD />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <NodePalette />
        <ReactFlowProvider>
          <FlowEditor />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
