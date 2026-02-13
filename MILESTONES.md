# Marble Machine Simulator — Milestones

> Implementation roadmap. Each milestone builds on the previous one. Simulation logic is always implemented and tested before UI code.

---

## Milestone 1 — Project Bootstrap

**Goal:** Working Vite + React + TypeScript project with strict typing, full directory skeleton, core simulation types, Zod schemas, seeded PRNG, and unit tests. No UI code beyond a minimal app shell.

### M1.1 — Vite + React + TS scaffold

- Run `npm create vite@latest . -- --template react-ts` (in-place, since the repo already exists).
- Modify `tsconfig.json`: enable `"strict": true`, `"noUncheckedIndexedAccess": true`, `"forceConsistentCasingInFileNames": true`.
- Install runtime deps: `@xyflow/react`, `zustand`, `zod`.
- Install dev deps: `vitest`, `@testing-library/react`, `@types/node`.
- Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`.
- Add a `vitest.config.ts` with `globals: true`.

### M1.2 — Directory structure

Create empty directories with barrel `index.ts` files where appropriate:

```
src/
  simulation/          # PURE TS — no React/Zustand/DOM imports
    types.ts
    schemas.ts
    rng.ts
    index.ts           # re-exports public API
  ui/
    nodes/             # (empty, placeholder for M4)
    editor/            # (empty, placeholder for M4)
    overlay/           # (empty, placeholder for M5)
    App.tsx            # minimal shell
  store/               # (empty, placeholder for M3)
  lib/
    constants.ts
    math.ts
  main.tsx
```

### M1.3 — Core types (`src/simulation/types.ts`)

Define all simulation data structures using discriminated unions. Every type is exported, fully documented with JSDoc comments explaining design decisions:

- `NodeId`, `EdgeId`, `MarbleId` — branded string type aliases.
- `SimNodeBase` — shared fields (id, type, position).
- `SourceNode`, `SinkNode`, `SplitterNode`, `ElevatorNode`, `RampNode` — each extending base with type-specific fields. (`GateNode`, `BucketNode` added in M9.)
- `SimNode` — discriminated union of all node types.
- `SimEdge` — from/to with handle IDs and computed length.
- `Marble` — edge-based positioning (edgeId + progress 0..1 + speed).
- `SimGraph` — indexed Maps for nodes, edges, adjacency.
- `SimState` — top-level: graph + marbles + tickCount + rng state.
- `ValidationResult` — success/failure with error messages (for DAG validation).

### M1.4 — Zod schemas (`src/simulation/schemas.ts`)

Mirror every type from `types.ts` with a Zod schema. Used at the UI-to-engine boundary to validate data coming from React Flow. Includes:

- `PositionSchema`, `SimNodeSchema` (discriminated via `z.discriminatedUnion`), `SimEdgeSchema`, `MarbleSchema`.
- `SimGraphSchema` — validates structural integrity (edge references existing node IDs).
- Export type inference: `type SimNode = z.infer<typeof SimNodeSchema>` kept in sync with manual types via `satisfies`.

### M1.5 — Seeded PRNG (`src/simulation/rng.ts`)

Implement mulberry32 algorithm. No `Math.random()` anywhere. The RNG state is a plain number (the seed), making it serializable and part of `SimState`. Exported functions:

- `createRng(seed: number): SeededRNG`
- `nextFloat(rng: SeededRNG): [number, SeededRNG]` — returns value in [0, 1) and the *next* RNG state (pure, no mutation).

### M1.6 — Constants and math (`src/lib/`)

- `constants.ts`: `TICK_RATE = 60`, `TICK_DT = 1/60`, `MAX_MARBLES = 1000`, `MAX_ACCUMULATOR = 0.25`.
- `math.ts`: `lerp(a, b, t)`, `clamp(val, min, max)`, `distance(p1, p2)` — all pure functions with JSDoc.

### M1.7 — Unit tests

- `src/simulation/__tests__/schemas.test.ts`: Zod schemas accept valid data, reject invalid data, round-trip correctly.
- `src/simulation/__tests__/rng.test.ts`: Same seed produces identical sequence; different seeds diverge; output is in [0, 1).
- `src/lib/__tests__/math.test.ts`: `lerp`, `clamp`, `distance` produce correct results for edge cases (t=0, t=1, negative values, zero distance).

### M1.8 — Minimal app shell

- `src/ui/App.tsx`: A single `<div>` with "Marble Machine Simulator" text. No React Flow, no Canvas, no state. Just proves the Vite dev server boots and renders.
- `src/main.tsx`: Standard React 18 `createRoot` entry point.

### Constraints enforced

- No UI code beyond the shell.
- No external state (no Zustand stores yet).
- All simulation code is pure TS — verified by absence of React/Zustand imports.
- All logic is deterministic — RNG is seeded, no `Math.random()`.
- Every file includes JSDoc comments explaining design decisions.

---

## Milestone 2 — Simulation Core

**Goal:** Implement the core graph logic and tick engine as pure TypeScript. Prove determinism with tests.

### Tasks

- Implement `graph.ts`: `buildSimGraph`, `validateDAG` (Kahn's algorithm), `computeEdgeLengths`.
- Implement graph factory/mutation functions in `graph.ts`:
  - `createNode(type, position, overrides?): SimNode` — Factory for each node type with sensible defaults.
  - `createEdge(from, fromHandle, to, toHandle): SimEdge` — Creates an edge, auto-generates ID.
  - `addNode(graph, node): SimGraph` — Returns new graph with node added + adjacency updated.
  - `removeNode(graph, nodeId): SimGraph` — Returns new graph with node and all connected edges removed.
  - `addEdge(graph, edge): SimGraph` — Returns new graph with edge added + adjacency updated. Rejects if it would create a cycle (calls `validateDAG` internally).
  - `removeEdge(graph, edgeId): SimGraph` — Returns new graph with edge removed + adjacency updated.
- Implement `engine.ts`: `tick()` with three phases (advanceMarbles, processArrivals, spawnMarbles).
- Implement `behaviors.ts`: Node handler registry for source, sink, splitter, elevator, ramp.
- Write Vitest tests proving determinism (same seed + same graph = same marble positions after N ticks).

### Constraints

- All mutation functions are pure (return new `SimGraph`, never mutate input).
- Unit tests cover: add/remove round-trips, cycle rejection on `addEdge`, orphan cleanup on `removeNode`.
- No UI code. No external state.

---

## Milestone 3 — Zustand Bridge

**Goal:** Connect the simulation engine to the UI layer through Zustand stores.

### Tasks

- Implement `graphStore.ts`: React Flow node/edge state + `toSimGraph()` conversion.
- Implement `simulationStore.ts`: SimState lifecycle, `start`/`pause`/`reset`/`step` actions, interpolation alpha.
- Implement `tickLoop.ts`: `requestAnimationFrame`-based fixed-timestep accumulator.
- Verify tick runs correctly with a hardcoded graph.

### Key constants

- `TICK_RATE = 60`, `TICK_DT = 1/60`
- Max accumulated time capped at 0.25s to prevent spiral-of-death.

---

## Milestone 4 — React Flow Editor

**Goal:** Visual editor to manipulate the graph data structure.

### Tasks

- Initialize React Flow instance in `FlowEditor.tsx`.
- Create custom node components with semantic handles:
  - `SourceNode.tsx` — handle: `source-output`
  - `SinkNode.tsx` — handle: `sink-input`
  - `SplitterNode.tsx` — handles: `splitter-input`, `splitter-left`, `splitter-right`
  - `ElevatorNode.tsx` — handles: `elevator-input`, `elevator-output`
  - `RampNode.tsx` — handles: `ramp-input`, `ramp-output`
- Register all custom nodes in `nodeTypes.ts`.
- Create `NodePalette.tsx`: sidebar with draggable node types.
- Implement connection validation via `isValidConnection` (consults `validateDAG`).
- Bidirectional sync between React Flow state and `graphStore`.

---

## Milestone 5 — Canvas Rendering

**Goal:** Smooth marble visualization with interpolation between tick states.

### Tasks

- Create `MarbleCanvas.tsx`: `<canvas>` overlay on top of React Flow.
- Read `simState`, `prevState`, and `interpolationAlpha` from the simulation store.
- Render marbles at interpolated positions: `renderPosition = lerp(prevPosition, currentPosition, alpha)`.
- Basic circle rendering per marble.

---

## Milestone 6 — HUD and Polish

**Goal:** Playback controls and visual feedback.

### Tasks

- Create `HUD.tsx` with Play/Pause/Step/Reset buttons.
- Connect buttons to `simulationStore` actions.
- Add speed multiplier slider.
- Display marble count and tick count.
- Add visual feedback on nodes (active source glow, sink counter badge).

---

## Milestone 7 — Loop Detection and Stats

**Goal:** Detect runtime marble loops and track throughput statistics. Pure simulation logic — no UI code except a stats display component.

### Tasks

- Implement `src/simulation/analysis.ts`:
  - `detectMarbleLoop(state, historyWindow): LoopResult` — Tracks marble edge-visit patterns over a sliding window of N ticks. If a marble visits the same sequence of edges repeatedly, flag it as looping. Returns loop path and period.
  - `computeStats(state, prevState): SimStats` — Pure function computing: total marbles spawned, total consumed (sinks), active marble count, per-node throughput (marbles/tick passing through).
- Add `SimStats` type to `types.ts`: `{ totalSpawned, totalConsumed, activeCount, throughputByNode: Map<NodeId, number>, detectedLoops: LoopResult[] }`.
- Compute stats in the tick loop and store on `SimState` (or a companion field in the simulation store).
- Extend HUD to show throughput stats and loop warnings.

### Unit Tests

- Construct a graph with a known cycle path, run N ticks, verify loop detection triggers.
- Test stats counters across 10+ ticks.

---

## Milestone 8 — Persistence (Save/Load)

**Goal:** Serialize and restore graph state for session continuity and sharing.

### Tasks

- Implement `src/simulation/persistence.ts`:
  - `serializeGraph(graph: SimGraph): string` — Converts `SimGraph` (which uses Maps) into a JSON-safe plain object, then `JSON.stringify`. Zod schema validates output shape.
  - `deserializeGraph(json: string): SimGraph | ValidationError` — Parses JSON, validates with Zod schemas, reconstructs Maps and adjacency. Returns typed errors on invalid input.
- Implement `src/store/persistenceStore.ts` (or extend `graphStore`):
  - `saveToLocalStorage()` — Auto-saves current graph on every edit (debounced, 1s).
  - `loadFromLocalStorage()` — Restores graph on app boot if saved state exists.
  - `exportJSON(): string` — Returns JSON string for download.
  - `importJSON(json: string): void` — Validates and loads graph from pasted/uploaded JSON.
- Create `src/ui/overlay/PersistenceControls.tsx` — Export and Import buttons in the HUD area. Export triggers a file download. Import opens a file picker.

### Unit Tests

- Serialize -> deserialize round-trip preserves all node/edge data.
- Malformed JSON returns a typed error.
- LocalStorage mock tests for save/load.

---

## Milestone 9 — Advanced Nodes: Gate and Bucket

**Goal:** Extend the node system with conditional logic (Gate) and physics-based containers (Bucket). Simulation logic first, visualization second.

### Gate Node — Conditional Pass

A gate either blocks or passes marbles based on a configurable condition. One input handle, one output handle.

- Add `GateNode` to the discriminated union in `types.ts`:
  - `condition: GateCondition` — discriminated union on `kind`: `marbleCount`, `tickInterval`, `manual`.
  - `isOpen: boolean` — current state, mutated per tick.
  - `heldMarbles: MarbleId[]` — FIFO queue of marbles waiting while gate is closed.
- Implement `handleGate` in `behaviors.ts`:
  - `marbleCount`: count arrivals, open when threshold met, reset counter.
  - `tickInterval`: `isOpen = (tickCount % period) < (period / 2)` — deterministic square wave.
  - `manual`: `isOpen` is only changed by an external action (wired through the store).
  - If open: release held marbles (FIFO), pass arriving marbles through.
  - If closed: push arriving marbles into `heldMarbles` queue.
- Add `GateConditionSchema` and `GateNodeSchema` to `schemas.ts`.

### Bucket Node — Fill-Based Container

A bucket accumulates marbles up to a capacity, then releases them all at once. One input handle, one output handle.

- Add `BucketNode` to the discriminated union in `types.ts`:
  - `capacity: number` — max marbles before release.
  - `currentFill: number` — how many are currently held.
  - `releaseMode: 'all' | 'overflow'` — release strategy.
- Implement `handleBucket` in `behaviors.ts`:
  - On marble arrival: increment `currentFill`.
  - When `currentFill >= capacity`:
    - `'all'` mode: spawn `capacity` marbles on the output edge, reset `currentFill` to 0.
    - `'overflow'` mode: spawn only the excess, clamp `currentFill` to `capacity`.
  - Released marbles get deterministic IDs (based on tickCount + node ID).
- Add `BucketNodeSchema` to `schemas.ts`.

### Visualization (after logic is proven)

- `GateNode.tsx`: gate icon with open/closed indicator, held marble count badge, clickable toggle for `manual` condition. Handles: `gate-input`, `gate-output`.
- `BucketNode.tsx`: container with fill-level indicator (0%–100% bar), `currentFill / capacity` text. Handles: `bucket-input`, `bucket-output`.
- Register both in `nodeTypes.ts`.
- Canvas overlay: no changes needed — held marbles are shown on node components, not on the canvas.

### Unit Tests

- `gate.test.ts`:
  - `tickInterval`: verify open/closed alternation over 20 ticks.
  - `marbleCount`: send N-1 marbles (closed), Nth marble (opens, all released).
  - FIFO order on release.
  - Determinism: same inputs = identical gate state after N ticks.
- `bucket.test.ts`:
  - `'all'` mode: fill to capacity, verify all released, `currentFill` resets to 0.
  - `'overflow'` mode: verify only excess released, `currentFill` stays at capacity.
  - Unique, deterministic IDs on released marbles.
  - Empty bucket: no release events.

### Constraints enforced

- Logic in `src/simulation/` first — pure TS, no React imports, no external state.
- All behavior is deterministic — gate conditions use `tickCount`, not wall-clock time.
- Visualization components added only after unit tests pass.
- Follows the existing node behavior registry pattern — no modifications to `engine.ts` or `tick()` needed.
