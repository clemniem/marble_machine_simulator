import { useRef, useEffect } from 'react';
import { useStore } from '@xyflow/react';
import { useSimulationStore } from '../../store/simulationStore.js';
import { useGraphStore } from '../../store/graphStore.js';
import { lerp, clamp } from '../../lib/math.js';
import type { Marble, SimState, Position } from '../../simulation/types.js';

const MARBLE_RADIUS = 6;
const MARBLE_COLOR = '#1e293b';
const MARBLE_BORDER = '#e2e8f0';

// ---------------------------------------------------------------------------
// Edge path sampling — follow React Flow's SVG bezier curves
// ---------------------------------------------------------------------------

/**
 * Build a lookup from edge ID → SVGPathElement by querying the DOM.
 * React Flow renders each edge as a `<g data-id="{edgeId}">` containing
 * a `<path class="react-flow__edge-path">`. We sample that path with
 * `getPointAtLength()` so marbles follow the exact visual curve.
 */
function collectEdgePaths(): Map<string, SVGPathElement> {
  const map = new Map<string, SVGPathElement>();
  const edgeGroups = document.querySelectorAll('.react-flow__edge[data-id]');
  for (const g of edgeGroups) {
    const id = g.getAttribute('data-id');
    if (!id) continue;
    const path = g.querySelector<SVGPathElement>('path.react-flow__edge-path');
    if (path) map.set(id, path);
  }
  return map;
}

/**
 * Sample a point on the SVG path at the given progress (0..1).
 * Returns flow-space coordinates, or null if the path is missing.
 */
function sampleEdgePath(
  pathEl: SVGPathElement,
  progress: number,
): { x: number; y: number } | null {
  try {
    const len = pathEl.getTotalLength();
    if (len === 0) return null;
    const pt = pathEl.getPointAtLength(clamp(progress, 0, 1) * len);
    return { x: pt.x, y: pt.y };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Marble → screen position
// ---------------------------------------------------------------------------

/**
 * Primary path: follow the SVG edge curve.
 * Fallback: linear interpolation between node centres.
 */
function marbleToScreen(
  marble: Marble,
  state: SimState,
  edgePaths: Map<string, SVGPathElement>,
  rfPositions: Map<string, { x: number; y: number; w: number; h: number }>,
  vp: { x: number; y: number; zoom: number },
): Position | null {
  const edge = state.graph.edges.get(marble.edgeId);
  if (!edge) return null;

  const progress = clamp(marble.progress, 0, 1);

  // Try the real SVG path first
  const pathEl = edgePaths.get(marble.edgeId);
  if (pathEl) {
    const pt = sampleEdgePath(pathEl, progress);
    if (pt) {
      return {
        x: pt.x * vp.zoom + vp.x,
        y: pt.y * vp.zoom + vp.y,
      };
    }
  }

  // Fallback: straight line between node centres
  const fromRect = rfPositions.get(edge.from);
  const toRect = rfPositions.get(edge.to);
  if (!fromRect || !toRect) return null;

  const worldX = lerp(fromRect.x + fromRect.w / 2, toRect.x + toRect.w / 2, progress);
  const worldY = lerp(fromRect.y + fromRect.h / 2, toRect.y + toRect.h / 2, progress);

  return {
    x: worldX * vp.zoom + vp.x,
    y: worldY * vp.zoom + vp.y,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarbleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const vpSelector = (s: { transform: [number, number, number] }) => s.transform;
  const transform = useStore(vpSelector);

  useEffect(() => {
    let running = true;

    function draw() {
      if (!running) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Resize canvas to match parent
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? canvas.clientWidth;
      const h = parent?.clientHeight ?? canvas.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { simState, prevState, interpolationAlpha } = useSimulationStore.getState();
      if (!simState || simState.marbles.length === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const rfNodes = useGraphStore.getState().nodes;
      const vp = { x: transform[0], y: transform[1], zoom: transform[2] };

      // Collect SVG path elements once per frame
      const edgePaths = collectEdgePaths();

      // Node position lookup (fallback)
      const rfPositions = new Map<string, { x: number; y: number; w: number; h: number }>();
      for (const node of rfNodes) {
        rfPositions.set(node.id, {
          x: node.position.x,
          y: node.position.y,
          w: (node.measured?.width as number) ?? 80,
          h: (node.measured?.height as number) ?? 40,
        });
      }

      const radius = Math.max(MARBLE_RADIUS * vp.zoom, 3);

      ctx.fillStyle = MARBLE_COLOR;
      ctx.strokeStyle = MARBLE_BORDER;
      ctx.lineWidth = 1.5;

      for (const marble of simState.marbles) {
        const curPos = marbleToScreen(marble, simState, edgePaths, rfPositions, vp);
        if (!curPos) continue;

        let drawPos = curPos;

        // Smooth interpolation between prev and current tick
        if (prevState) {
          const prevMarble = prevState.marbles.find((m) => m.id === marble.id);
          if (prevMarble) {
            const prevPos = marbleToScreen(prevMarble, prevState, edgePaths, rfPositions, vp);
            if (prevPos) {
              drawPos = {
                x: lerp(prevPos.x, curPos.x, interpolationAlpha),
                y: lerp(prevPos.y, curPos.y, interpolationAlpha),
              };
            }
          }
        }

        ctx.beginPath();
        ctx.arc(drawPos.x, drawPos.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [transform]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
}
