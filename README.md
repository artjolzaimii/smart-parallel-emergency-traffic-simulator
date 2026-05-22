# Smart Parallel Emergency Response & Traffic Control Simulator

**SPERTS** is a real-time city traffic simulator built to demonstrate the practical impact of parallel programming on computationally expensive urban planning problems. The simulator models an ambulance dispatching from the Grand Park / Artificial Lake area of Tirana, Albania, navigating to QSUT University Hospital through a live OSM-derived road graph — while vehicles move, incidents spawn, congestion evolves, and traffic lights respond to emergency priority.

The entire simulation backend runs inside a Next.js server process. A WebSocket connection streams live snapshots to the browser at every tick. All performance numbers displayed — tick cost, route compute time, benchmark speedup — are **real measured values from `performance.now()`**, never estimated or hardcoded.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [System Architecture](#3-system-architecture)
4. [Parallel Programming Concepts](#4-parallel-programming-concepts)
5. [Important Code Sections](#5-important-code-sections)
6. [Why Parallel Programming Helps Here](#6-why-parallel-programming-helps-here)
7. [How the Simulation Works](#7-how-the-simulation-works)
8. [Installation](#8-installation)
9. [Running the Project](#9-running-the-project)
10. [Demo Workflow](#10-demo-workflow)
11. [Benchmark Explanation](#11-benchmark-explanation)
12. [Folder Structure](#12-folder-structure)
13. [Technologies Used](#13-technologies-used)
14. [Academic Relevance](#14-academic-relevance)
15. [Future Improvements](#15-future-improvements)

---

## 1. Project Overview

### The Real-World Problem

Emergency vehicles in dense urban environments face a fundamental challenge: every second lost in transit is a second lost in medical response. A city's road network is not static — it is a dynamic graph where edge weights (travel cost) change continuously due to congestion, incidents, traffic signals, and road blockages. An ambulance dispatcher cannot rely on a pre-computed route; it must find the current best path, detect when that path degrades, and re-plan in real time.

This simulator models exactly that scenario:

- An ambulance is dispatched from the Botanical Park area (Parku Artificial) of Tirana
- Its destination is QSUT University Hospital, ~3.5 km north through the city centre
- The road network is derived from real OpenStreetMap data via the Overpass API
- Congestion evolves dynamically each tick using sinusoidal functions applied to live edge weights
- Incidents can block edges and force the ambulance to reroute from its current position
- Traffic lights near the emergency route are set to green while the dispatch is active

### Why Parallel Programming Matters Here

Route optimization is inherently expensive. Finding the optimal path in a weighted city graph using A* is O(E log V) per query. In practice, a robust emergency routing system evaluates **multiple strategies** simultaneously: a standard shortest-time path, a congestion-avoiding path, a blocked-edge-free path, and a raw speed-preference path. Each strategy produces a different weighted graph, and each requires an independent A* search.

Four strategies × N candidate origin-destination pairs = N×4 A* searches with **zero shared mutable state between them**. This is an embarrassingly parallel workload. Node.js worker threads allow these searches to run across CPU cores simultaneously, reducing wall-clock time by a factor proportional to the number of cores available.

The benchmark panel in the UI measures and proves this speedup with real timings.

---

## 2. Key Features

| Feature | Description |
|---|---|
| **Real OSM road graph** | Fetches central Tirana roads from the Overpass API and caches a routing-ready graph JSON. Falls back to a hand-crafted mock graph if offline. |
| **Live vehicle simulation** | Up to 500 civilian vehicles (cars, trucks, motorcycles) move along OSM edges using graph-based interpolation. |
| **Ambulance emergency dispatch** | Single ambulance moves edge-by-edge along the computed route with live ETA and distance countdown. |
| **Dynamic A\* routing** | Route is computed using a custom A* with a min-heap. Four strategies are evaluated; the lowest-cost path is selected. |
| **Incident system** | Manual and auto-spawned incidents block or congest edges. Manual incidents prefer to target the active emergency route. |
| **Traffic light priority** | Traffic lights within 200 m of the emergency route waypoints are forced to green while the dispatch is active. |
| **Sequential vs Parallel modes** | All vehicle updates and route computations can run in either mode. The mode is switchable live without restarting. |
| **Live rerouting** | The engine scans 5 edges ahead on the ambulance's route each tick. On detecting a blocked edge, it immediately triggers an async A* reroute from the ambulance's current position. |
| **WebSocket streaming** | Every simulation tick broadcasts a full state snapshot to all connected browser clients via WebSocket. |
| **Benchmark / stress test** | A dedicated benchmark panel runs sequential and parallel route optimization passes over N candidate pairs and reports throughput (candidates/sec), speedup, efficiency, and improvement percentage — all measured. |
| **Dashboard analytics** | Live metrics panel with vehicle count, congestion level, emergency ETA, worker thread count, tick rate, and performance chart. |

---

## 3. System Architecture

### Text Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js 16)                       │
│                                                                    │
│  ┌──────────────────┐  ┌────────────────────┐  ┌────────────────┐ │
│  │  MapClient       │  │  MetricsPanel      │  │  ControlPanel  │ │
│  │  (React Leaflet) │  │  BenchmarkPanel    │  │  SimControls   │ │
│  │  VehicleLayer    │  │  EmergencyMetrics  │  │  IncidentBtn   │ │
│  │  RouteLayer      │  │  PerformanceChart  │  │  ModeToggle    │ │
│  └────────┬─────────┘  └─────────┬──────────┘  └───────┬────────┘ │
│           │                      │                     │          │
│           └──────────────────────┴─────────────────────┘          │
│                             Zustand Stores                         │
│         vehicleStore / emergencyStore / metricsStore / wsStore     │
│                                │                                   │
│                       websocketService.ts                          │
└────────────────────────────────┼───────────────────────────────────┘
                          WebSocket (ws://localhost:3001)
┌────────────────────────────────┼───────────────────────────────────┐
│                      Node.js Server Process                        │
│                                                                    │
│                      WebSocketServer.ts                            │
│                      MessageRouter.ts                              │
│                                │                                   │
│                      SimulationEngine.ts ◄──── BenchmarkRunner.ts  │
│         ┌──────────────────────┼───────────────────┐              │
│         │                      │                   │              │
│  SequentialExecutor    ParallelExecutor      EmergencyRouter       │
│  (main thread)         (4 × Worker)          (4 × Worker)          │
│         │                      │                   │              │
│         │              vehicleWorker.ts    routingWorker.ts        │
│         │                                 routeScoringWorker.ts    │
│         │                                                          │
│  ─────────────────────────────────────────────────────────────    │
│  loadRoadGraph.ts  →  tirana-road-graph.json  (OSM cache)         │
│  tiranaRoadGraph.ts  (mock fallback)                               │
│  aStar.ts  /  roadGraph.ts                                         │
│  IncidentManager.ts                                                │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Module | Responsibility |
|---|---|
| `SimulationEngine` | Master loop. Owns all simulation state. Ticks vehicles, incidents, congestion. Triggers routing and ambulance movement. Broadcasts snapshots. |
| `SequentialExecutor` | Moves all vehicles in the main thread in one pass. Measures wall-clock cost honestly. |
| `ParallelExecutor` | Splits vehicles into 4 equal chunks. Dispatches each chunk to a persistent worker via `postMessage`. Merges results. |
| `EmergencyRouter` | Holds the live edge state (with incident overrides). Runs A* per strategy. In parallel mode uses 4 worker threads. |
| `BenchmarkRunner` | Generates deterministic origin-destination task sets. Runs multi-strategy A* sequentially or in parallel. Measures throughput and speedup. |
| `IncidentManager` | Spawns auto and manual incidents. Applies edge congestion boosts and blockages. Prefers route edges on manual spawn. |
| `loadRoadGraph` | Loads and validates the OSM cache. Falls back to mock graph. Overrides `startNodeId` at runtime via nearest-node lookup. |
| `MessageRouter` | Routes incoming WebSocket commands to engine methods. |
| `BroadcastManager` | Fans out the snapshot JSON to all connected WebSocket clients. |
| Zustand stores | Thin reactive state bridges between WebSocket service and React components. No logic. |

---

## 4. Parallel Programming Concepts

### 4.1 Worker Threads

The project uses Node.js `worker_threads` — true OS threads with separate V8 heaps — rather than `child_process` or browser Web Workers. Workers are imported as TypeScript files using `tsx` as the import hook (`execArgv: ['--import', 'tsx']`), which allows sharing type definitions with the main thread without a separate build step.

Three distinct worker types exist:

| Worker | File | Purpose |
|---|---|---|
| Vehicle worker | `vehicleWorker.ts` | Processes a chunk of civilian vehicles per tick |
| Routing worker | `routingWorker.ts` | Runs A* for one route strategy (used by `EmergencyRouter`) |
| Scoring worker | `routeScoringWorker.ts` | Evaluates all 4 strategies on a subset of candidate pairs (used by `BenchmarkRunner`) |

### 4.2 Task Parallelism

Both the routing system and the benchmark demonstrate **task parallelism**: the same logical operation (A* pathfinding) is applied to independent inputs simultaneously across workers.

In `EmergencyRouter`, four strategies (`standard`, `avoid-congestion`, `avoid-blocked`, `prefer-speed`) are dispatched to four workers with `Promise.all`. Each worker receives the same graph but applies a different weight transformation before searching. There is no shared mutable state — each worker operates on its own in-memory copy of the edge array.

In `BenchmarkRunner`, N candidate pairs are split into 4 equal chunks. Each worker receives its chunk and runs all 4 strategies on every pair in its chunk. Total work = N × 4 A* searches, split evenly.

### 4.3 Data Partitioning

The benchmark splits the candidate task array using a ceiling-division chunk scheme:

```typescript
const chunkSize = Math.ceil(tasks.length / WORKER_COUNT);
const chunks = Array.from({ length: WORKER_COUNT }, (_, i) =>
  tasks.slice(i * chunkSize, (i + 1) * chunkSize),
).filter((c) => c.length > 0);
```

Each chunk is an independent slice — no overlap, no synchronization needed during execution. Workers do not communicate with each other; they only send a result back to the main thread via `parentPort.postMessage`.

For vehicle movement, `ParallelExecutor` applies the same pattern: the vehicle array is split into contiguous chunks by vehicle index.

### 4.4 Sequential vs Parallel Comparison

The simulation engine maintains both execution paths simultaneously. In sequential mode, `SequentialExecutor.execute()` runs the vehicle update loop in the main thread and measures the wall-clock duration. In parallel mode, `ParallelExecutor.execute()` distributes the same work across workers and measures the total round-trip time including IPC.

Both modes produce identical output. The difference is only execution time — and the benchmark panel measures it honestly.

### 4.5 IPC Overhead and Why Not All Tasks Benefit

A critical engineering insight demonstrated by this simulator: **parallelism is not always faster**.

Vehicle coordinate updates take approximately 0.01–0.05 ms for 50 vehicles in the main thread. Dispatching 50 vehicles to 4 workers via `postMessage`, waiting for results, and merging them incurs ~10–50 ms of serialization and IPC overhead. For this lightweight task, the parallel cost is orders of magnitude higher than the sequential cost.

The live tick cost panel explicitly labels this: the parallel tick time is higher than sequential for vehicle movement. This is an honest observation, not a bug.

Route optimization using A* is a fundamentally different class of work. A single A* run over a 5,000-node OSM graph (central Tirana) takes 10–100 ms of CPU time. Evaluating 100 candidates × 4 strategies = 400 A* calls, taking several seconds sequentially. This is the correct target for parallel acceleration.

### 4.6 Persistent Worker Pools

The `BenchmarkRunner` spawns workers once per benchmark phase and reuses them across all iterations:

```typescript
// Workers spawned once and reused across all iterations to amortise startup cost
const workers = chunks.map(
  () => new Worker(workerPath, { execArgv: ['--import', 'tsx'] }),
);
for (let iter = 0; iter < iterationCount; iter++) {
  await Promise.all(chunks.map((chunk, wi) => sendToWorker(workers[wi], chunk)));
}
for (const w of workers) w.terminate();
```

This amortises the startup cost (50–200 ms per worker) across multiple iterations, making the comparison fair. A naive implementation that spawns fresh workers per iteration would produce misleading results dominated by spawn overhead.

---

## 5. Important Code Sections

### 5.1 ParallelExecutor — Vehicle Chunk Dispatch

```typescript
// src/simulation/engine/ParallelExecutor.ts
const WORKER_COUNT = 4;

async execute(vehicles, graphStates, edges, adjacency): Promise<ExecutorResult> {
  const start = performance.now();

  const chunkSize = Math.ceil(vehicles.length / this.workers.length);
  const chunks = [];
  for (let i = 0; i < vehicles.length; i += chunkSize) {
    chunks.push({
      vehicles: vehicles.slice(i, i + chunkSize),
      graphStates: graphStates.slice(i, i + chunkSize),
    });
  }

  const results = await Promise.all(
    chunks.map((chunk, i) =>
      this.dispatch(this.workers[i % this.workers.length], {
        vehicles: chunk.vehicles,
        graphStates: chunk.graphStates,
        edges,
        adjacency,
      }),
    ),
  );

  return {
    vehicles: results.flatMap((r) => r.vehicles),
    graphStates: results.flatMap((r) => r.graphStates),
    durationMs: performance.now() - start,
  };
}
```

### 5.2 Vehicle Worker — Worker Thread Entry Point

```typescript
// src/workers/vehicleWorker.ts
import { parentPort } from 'worker_threads';
import { moveVehicleOnGraph } from '../simulation/vehicles/VehicleMovement';

parentPort?.on('message', ({ vehicles, graphStates, edges, adjacency }) => {
  const edgesMap = new Map(edges.map((e) => [e.id, e]));
  const stateMap = new Map(graphStates.map((s) => [s.id, s]));

  const results = vehicles.map((v) => {
    const state = stateMap.get(v.id);
    if (!state) return { vehicle: v, state: { id: v.id, edgeId: '', progress: 0 } };
    return moveVehicleOnGraph(v, state, edgesMap, adjacency);
  });

  parentPort?.postMessage({
    vehicles: results.map((r) => r.vehicle),
    graphStates: results.map((r) => r.state),
  });
});
```

### 5.3 Route Scoring Worker — Multi-Strategy A* per Chunk

```typescript
// src/workers/routeScoringWorker.ts
const STRATEGIES = ['standard', 'avoid-congestion', 'avoid-blocked', 'prefer-speed'];

parentPort?.on('message', ({ tasks, nodes, edges }: WorkerInput) => {
  const start = performance.now();
  const nodesMap = new Map(nodes.map((n) => [n.id, n]));
  let scored = 0;

  for (const task of tasks) {
    for (const strategy of STRATEGIES) {
      const stratEdges = applyStrategy(edges, strategy);
      const adj = buildAdjacency(stratEdges);
      aStar(nodesMap, adj, task.fromNodeId, task.toNodeId);
      scored++;
    }
  }

  parentPort?.postMessage({ scored, durationMs: performance.now() - start });
});
```

### 5.4 BenchmarkRunner — Sequential vs Parallel Phases

```typescript
// src/simulation/benchmark/BenchmarkRunner.ts

// Sequential: all candidates × all strategies in one thread
for (let iter = 0; iter < iterationCount; iter++) {
  runSequential(tasks, this.graph.nodesMap, slimEdges);
  onProgress(Math.round(((iter + 1) / iterationCount) * 50));
}

// Parallel: candidates split across WORKER_COUNT persistent workers
const workers = chunks.map(
  () => new Worker(workerPath, { execArgv: ['--import', 'tsx'] }),
);
for (let iter = 0; iter < iterationCount; iter++) {
  await Promise.all(
    chunks.map((chunk, wi) =>
      new Promise<void>((resolve, reject) => {
        const w = workers[wi];
        w.once('message', () => resolve());
        w.once('error', reject);
        w.postMessage({ tasks: chunk, nodes, edges: slimEdges });
      }),
    ),
  );
}

// Derived metrics — all computed from real performance.now() timestamps
speedup        = seqResult.totalMs / parResult.totalMs;
efficiency     = speedup / WORKER_COUNT;
improvementPct = (1 - parResult.totalMs / seqResult.totalMs) * 100;
```

### 5.5 A\* Pathfinding — Time-Based Heuristic with Min-Heap

```typescript
// src/simulation/pathfinding/aStar.ts
export function aStar(nodes, adjacency, startId, goalId): PathResult {
  const heuristic = (id: string): number => {
    const node = nodes.get(id);
    // Admissible: straight-line distance at 60 kph (never overestimates)
    return (haversineM(node.position, goal.position) / 1000 / 60) * 3600;
  };

  const gScore = new Map([[startId, 0]]);
  const heap = new MinHeap();
  heap.push(heuristic(startId), startId);

  while (heap.size > 0) {
    const current = heap.pop();
    if (current === goalId) return buildPath(...);

    for (const edge of adjacency.get(current) ?? []) {
      const cost = edgeTravelCostS(edge); // Infinity if blocked
      const tentative = gScore.get(current) + cost;
      if (tentative < (gScore.get(edge.to) ?? Infinity)) {
        gScore.set(edge.to, tentative);
        heap.push(tentative + heuristic(edge.to), edge.to);
      }
    }
  }
}
```

Edge travel cost accounts for base speed, congestion multiplier, and traffic light delay:

```typescript
// src/simulation/pathfinding/roadGraph.ts
export function edgeTravelCostS(edge: RoadEdge): number {
  if (edge.blocked) return Infinity;
  const baseTravelS = (edge.distanceM / 1000 / edge.baseSpeedKph) * 3600;
  // Congestion 0 = 1×, full congestion = 4× travel time
  return baseTravelS * (1 + edge.congestion * 3) + edge.trafficLightDelayS;
}
```

### 5.6 WebSocket Command Handling

```typescript
// src/websocket/MessageRouter.ts
handle(msg: ClientMessage, _ws: WebSocket): void {
  switch (msg.type) {
    case 'START_SIMULATION':    this.engine.start(); break;
    case 'TRIGGER_EMERGENCY':   this.engine.triggerEmergency(); break;
    case 'CREATE_INCIDENT':     this.engine.createManualIncident(); break;
    case 'TOGGLE_AUTO_REROUTE': this.engine.toggleAutoReroute(); break;
    case 'RUN_BENCHMARK':
      void this.engine.runBenchmark(
        Number(msg.payload?.candidateCount ?? 100),
        Number(msg.payload?.iterationCount ?? 3),
        msg.payload?.mode as BenchmarkMode ?? 'comparison',
      );
      break;
  }
}
```

### 5.7 SequentialExecutor — Honest Baseline Measurement

```typescript
// src/simulation/engine/SequentialExecutor.ts
execute(vehicles, graphStates, ctx): ExecutorResult {
  const start = performance.now();
  const stateMap = new Map(graphStates.map((s) => [s.id, s]));

  const results = vehicles.map((v) => {
    const state = stateMap.get(v.id);
    return moveVehicleOnGraph(v, state, ctx.edgesMap, ctx.adjacency);
  });

  return {
    vehicles: results.map((r) => r.vehicle),
    graphStates: results.map((r) => r.state),
    durationMs: performance.now() - start, // real measured cost
  };
}
```

---

## 6. Why Parallel Programming Helps Here

### Vehicle Movement: Wrong Target

Each vehicle tick updates a position by computing `deltaProgress = speedMps / edgeDistanceM` and calling `interpolateEdge()`. For 50 vehicles, this takes < 0.05 ms in a single thread. IPC alone (serializing vehicle arrays, posting to worker, deserializing) costs 10–50 ms. The parallel overhead is 200–1000× the actual work. The live tick cost panel displays both timings honestly and notes: *"IPC overhead dominates in parallel mode."*

### Route Optimization: Correct Target

A* on central Tirana's OSM graph (~5,000 nodes, ~12,000 edges) takes 10–100 ms per call depending on path length. Four strategies × 100 candidate pairs = 400 A* calls ≈ 4–40 seconds sequentially. Distributing across 4 workers reduces this to ~1–10 seconds — a measured 2–4× speedup, reflected accurately in the benchmark panel.

The key properties that make this workload parallel-friendly:

1. **Compute-bound** — A* is pure CPU work with no I/O
2. **No shared mutable state** — each A* call operates on its own graph copy
3. **Embarrassingly parallel** — tasks are fully independent
4. **Sufficient granularity** — each task is large enough that IPC overhead is a small fraction of work time

### Benchmark Panel as Primary Proof

The "Live Tick Cost" chart shows vehicle movement — a deliberately bad parallel workload that demonstrates the concept of IPC overhead. The "Primary Parallel Benchmark" panel shows route optimization, where parallelism genuinely helps. Both measurements come from `performance.now()` with no synthetic augmentation.

---

## 7. How the Simulation Works

### Full Lifecycle

```
1. Server starts
   └─ SimulationEngine constructor
      ├─ loadRoadGraph() → OSM cache or mock graph
      ├─ generateFleet(vehicleCount, graph) → initial vehicle positions
      ├─ new EmergencyRouter(nodes, edges)
      ├─ new IncidentManager(nodes, edges, startId, goalId)
      ├─ new ParallelExecutor() → spawns 4 vehicleWorker threads
      └─ new BenchmarkRunner(graph)

2. Client connects via WebSocket
   └─ Receives initial SIMULATION_SNAPSHOT

3. START_SIMULATION command received
   └─ setInterval fires every (1000/speed) ms → tick_()

4. Each tick:
   ├─ Sequential: moveVehicleOnGraph() for all vehicles in main thread
   ├─ Parallel:   dispatch chunks to vehicleWorkers, await Promise.all
   ├─ evolveCongestion() → sinusoidal updates on edge weights
   ├─ incidentManager.tick() → expire old incidents, maybe spawn new
   ├─ router.applyIncidentOverrides() → merge incident overrides onto edges
   ├─ advanceAmbulance() → move ambulance if dispatch is active
   ├─ computeRouteQualityScore() → ratio of initial cost to current cost
   ├─ applyTrafficLightPriority() → green lights near emergency route
   └─ emit() → broadcast SIMULATION_SNAPSHOT to all WS clients

5. TRIGGER_EMERGENCY command received
   └─ dispatchState = { status: 'routing', ... }
      └─ runEmergencyRouting() async
         ├─ Sequential: one A* with standard strategy
         ├─ Parallel: 4 workers × 4 strategies → best result selected
         └─ dispatchState.status = 'active', routeEdgeIds populated

6. Ambulance moves (every tick while status === 'active'):
   ├─ delta = AMBULANCE_TICK_S / edgeTravelCostS(currentEdge)
   ├─ progressOnEdge += delta  (carries over across edges when delta > 1)
   ├─ interpolateEdge() → update ev-001 marker position on map
   ├─ checkRouteBlockage() → scan 5 edges ahead for blocked flag
   │    └─ If blocked: status = 'rerouting', rerouteAmbulanceFrom(currentNode)
   └─ updateDispatchMetrics() → recompute live ETA and distance remaining

7. CREATE_INCIDENT command received
   └─ incidentManager.createManual(tick, dispatchState.routeEdgeIds)
      ├─ Prefers to spawn on an active route edge
      └─ Applies congestion boost or edge block to affected edges

8. Blocked edge detected → checkRouteBlockage() in advanceAmbulance()
   └─ rerouteAmbulanceFrom(currentNodeId)
      ├─ Runs A* from current ambulance node (not original start)
      ├─ New routeEdgeIds replace old ones
      └─ Route polyline updates on next snapshot broadcast

9. Ambulance reaches goalNode
   └─ onAmbulanceArrived()
      ├─ status = 'completed'
      ├─ totalResponseTimeS recorded
      └─ emergencyActive = false

10. RUN_BENCHMARK command received
    └─ runBenchmark(candidateCount, iterationCount, mode)
       ├─ Pauses tick loop
       ├─ generateTasks() → N deterministic (from, to) pairs via mulberry32 RNG
       ├─ Sequential phase: N×4 A* in main thread, timing captured
       ├─ Parallel phase: N/4 tasks per worker × 4 workers, timing captured
       ├─ Derives speedup, efficiency, improvement %
       └─ Resumes tick loop, emits FullBenchmarkResult in next snapshot
```

---

## 8. Installation

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- Internet access for the initial road data fetch (optional — fallback graph is included)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/artjolzaimi/smart-parallel-emergency-traffic-simulator
cd smart-parallel-emergency-traffic-simulator

# 2. Install dependencies
npm install

# 3. (Optional but recommended) Fetch the OSM road graph for Tirana
#    Calls the Overpass API and saves data/roads/tirana-road-graph.json
#    The app works without this step — it falls back to a built-in mock graph
npm run generate:roads

# 4. Start the full application (Next.js dev server + WebSocket server)
npm run dev:all
```

### About `generate:roads`

The script `scripts/generateRoads.ts` queries the Overpass API for all drivable ways (primary, secondary, tertiary, residential, service) within a bounding box covering central Tirana (`41.308°N–41.348°N, 19.795°E–19.845°E`). It converts raw OSM data into the internal `{ nodes, edges, adjacency }` graph format and writes it to `data/roads/tirana-road-graph.json`.

The script retries three Overpass mirrors in sequence. If all fail (e.g., offline or rate-limited), it exits with an explanatory message and the app continues using the mock graph.

**When to re-run `generate:roads`:**
- After changing the bounding box in `scripts/generateRoads.ts`
- When you want fresher OSM data
- It does **not** need to be re-run after any code changes

---

## 9. Running the Project

```bash
npm run dev:all
```

This runs two processes concurrently via `concurrently`:
- **Next.js dev server** — `http://localhost:3000`
- **WebSocket simulation server** — `ws://localhost:3001`

The simulation WebSocket server is a standalone Node.js process (`src/websocket/index.ts`) that runs the `SimulationEngine` and broadcasts snapshots. The Next.js dev server serves the React frontend that connects to it.

No environment variables are required. The WebSocket URL is hardcoded in `src/services/websocketService.ts`.

---

## 10. Demo Workflow

Follow these steps to demonstrate all parallel programming features:

**Step 1 — Open the app** at `http://localhost:3000`. The map centers on Tirana between Grand Park and QSUT Hospital. The ambulance marker (AMB-01) sits at the Grand Park dispatch origin (`41.3104°N, 19.8085°E`).

**Step 2 — Set vehicle count** using the slider in the control panel. Try 50 for a fast demo or 300 to stress the parallel executor.

**Step 3 — Choose execution mode** — Sequential or Parallel. This mode affects both vehicle tick processing and emergency route computation.

**Step 4 — Start the simulation** by clicking Start. Vehicles begin moving along OSM road edges. The tick rate and congestion level update live in the right panel.

**Step 5 — Trigger Emergency**. The ambulance route computes immediately. In parallel mode, 4 strategies are evaluated simultaneously and the best is selected. The dashed route polyline appears on the map. The ambulance begins moving toward the hospital edge-by-edge, with live ETA and distance remaining visible in the Emergency Dispatch panel.

**Step 6 — Create an Incident**. With an active emergency, the incident will prefer to spawn on the ambulance's planned route, increasing congestion or blocking an edge outright.

**Step 7 — Watch the reroute**. If the incident blocks a route edge, the engine detects it within one tick (via the 5-edge lookahead), computes a new path from the ambulance's current position, and updates the route polyline. The dispatch panel shows "Rerouting…" then "En Route", and the reroute counter increments.

**Step 8 — Wait for arrival**. When the ambulance reaches QSUT Hospital, the dispatch panel shows "Arrived" with the total response time.

**Step 9 — Run the Benchmark**. Open the Primary Parallel Benchmark panel. Select 200 candidates and Standard (3 iterations). Click Comparison. Watch the progress bar. When complete, read:
- Sequential throughput (candidates/sec)
- Parallel throughput (candidates/sec)
- Speedup factor
- Efficiency (speedup / worker count)
- Improvement percentage

**Step 10 — Interpret results**. Compare the "Live Tick Cost" chart (vehicle movement — parallel is slower due to IPC) with the benchmark (route optimization — parallel is faster due to genuine CPU parallelism). This contrast demonstrates the central engineering lesson of the project.

---

## 11. Benchmark Explanation

### Key Terms

| Term | Meaning |
|---|---|
| **Candidate count** | Number of random (origin, destination) pairs generated for the workload. Each pair requires 4 A* searches (one per strategy). 100 candidates = 400 A* calls per iteration. |
| **Iteration count** | How many times the full workload is repeated. Higher values reduce timing noise. Results are summed over all iterations. |
| **Throughput** | Candidates processed per second: `(candidateCount × iterationCount × 1000) / totalMs`. Higher is better. |
| **Speedup** | `seqTotalMs / parTotalMs`. A speedup of 2.5× means parallel finished in 40% of the sequential time. |
| **Efficiency** | `speedup / workerCount`. Perfect efficiency = 1.0. Values below 1.0 indicate IPC overhead or load imbalance. |
| **Improvement %** | `(1 − parMs / seqMs) × 100`. Percentage of sequential time saved. |

### Why Parallel Overhead Appears in Live Tick Cost

Vehicle position updates take ~0.01–0.05 ms per tick for 50 vehicles. Serializing the vehicle array for `postMessage`, waiting for worker responses, and deserializing takes 10–50 ms. The parallel tick cost appears higher because the overhead is real and accurately measured. This is an intentional demonstration: parallelism only pays when compute time exceeds communication overhead.

### Why Benchmark is the Primary Proof

The benchmark workload (A* × 4 strategies × N candidates) is compute-bound with no shared state. With 200 candidates and 3 iterations, the sequential phase evaluates 2,400 A* calls in sequence; the parallel phase distributes them across 4 cores simultaneously. The speedup measured is genuine — no mock timings, no synthetic adjustments.

All values derive from `performance.now()` timestamps captured immediately before and after each work phase.

---

## 12. Folder Structure

```
smart-parallel-emergency-traffic-simulator/
│
├── app/                             # Next.js App Router
│   ├── layout.tsx
│   └── page.tsx                     # Main page — mounts simulation UI
│
├── src/
│   ├── components/                  # React UI (render only, no simulation logic)
│   │   ├── analytics/
│   │   │   ├── BenchmarkPanel/      # Primary parallel benchmark UI + controls
│   │   │   ├── BenchmarkChart/      # Recharts throughput comparison bar chart
│   │   │   ├── EmergencyMetrics/    # Live dispatch status, ETA, distance, reroutes
│   │   │   ├── EmergencyStatusPanel/# Route quality bar, incident count, toggles
│   │   │   ├── MetricsPanel/        # Right sidebar — all analytics panels composed
│   │   │   └── PerformanceChart/    # Live tick cost chart (vehicle movement)
│   │   ├── map/
│   │   │   ├── MapClient/           # Dynamic Leaflet map (SSR disabled)
│   │   │   ├── VehicleLayer/        # Vehicle marker rendering
│   │   │   └── RouteLayer/          # Emergency route polyline rendering
│   │   └── ui/
│   │       ├── ControlPanel/        # Start/pause/reset, vehicle count, mode toggle
│   │       ├── HowItWorksModal/     # Parallel concepts explainer
│   │       └── SimulationControls/  # Emergency, incident, reroute, priority buttons
│   │
│   ├── simulation/                  # All simulation logic — zero React imports
│   │   ├── engine/
│   │   │   ├── SimulationEngine.ts  # Master loop, ambulance lifecycle, snapshot
│   │   │   ├── SequentialExecutor.ts# Single-thread vehicle tick baseline
│   │   │   └── ParallelExecutor.ts  # 4-worker vehicle tick
│   │   ├── pathfinding/
│   │   │   ├── aStar.ts             # A* with min-heap, time-based heuristic
│   │   │   ├── roadGraph.ts         # RoadNode/RoadEdge types, edgeTravelCostS
│   │   │   ├── loadRoadGraph.ts     # OSM cache loader, nearest-node override
│   │   │   └── tiranaRoadGraph.ts   # Hand-crafted mock graph (18 nodes, 52 edges)
│   │   ├── emergency/
│   │   │   └── EmergencyRouter.ts   # Multi-strategy routing, parallel workers
│   │   ├── benchmark/
│   │   │   └── BenchmarkRunner.ts   # Route optimization benchmark, real timings
│   │   ├── incident/
│   │   │   └── IncidentManager.ts   # Incident lifecycle, route-preferring spawn
│   │   ├── vehicles/
│   │   │   ├── VehicleMovement.ts   # moveVehicleOnGraph, interpolateEdge
│   │   │   └── VehicleGraphState.ts # Per-vehicle (edgeId, progress) state
│   │   ├── traffic/                 # Traffic light phase logic
│   │   └── utils/
│   │       ├── fleetGenerator.ts    # Deterministic fleet placement on graph edges
│   │       └── geo.ts               # haversineM distance
│   │
│   ├── workers/                     # Worker thread entry points
│   │   ├── vehicleWorker.ts         # Vehicle chunk processing per tick
│   │   ├── routingWorker.ts         # One A* strategy (EmergencyRouter)
│   │   └── routeScoringWorker.ts    # All strategies on candidate chunk (benchmark)
│   │
│   ├── websocket/                   # WebSocket server (Node.js, not browser)
│   │   ├── WebSocketServer.ts       # ws.Server, connection management
│   │   ├── MessageRouter.ts         # Client message → engine method dispatch
│   │   └── BroadcastManager.ts      # Fan-out snapshot to all connected clients
│   │
│   ├── services/
│   │   └── websocketService.ts      # Browser WS client, snapshot → Zustand stores
│   │
│   ├── store/                       # Zustand v5 stores — reactive state, no logic
│   │   ├── vehicleStore.ts
│   │   ├── emergencyStore.ts        # Includes dispatchState for ambulance tracking
│   │   ├── metricsStore.ts
│   │   ├── simulationStore.ts
│   │   ├── benchmarkStore.ts
│   │   └── wsStore.ts
│   │
│   └── types/                       # Shared TypeScript interfaces
│       ├── emergency.ts             # RoutingResult, DispatchState, RouteStrategy
│       ├── snapshot.ts              # SimulationSnapshot — full broadcast payload
│       ├── benchmark.ts             # BenchmarkRunResult, FullBenchmarkResult
│       ├── map.ts                   # VehicleMarkerData, EmergencyRouteData
│       ├── metrics.ts               # PerformanceMetrics, BenchmarkComparison
│       └── incident.ts              # Incident type definitions
│
├── data/
│   ├── roads/
│   │   └── tirana-road-graph.json   # Cached OSM graph (generated by generate:roads)
│   └── scenarios/
│       └── tiranaMockData.ts        # Pre-WS placeholder: vehicles, route, lights
│
├── scripts/
│   └── generateRoads.ts             # Overpass API fetcher → tirana-road-graph.json
│
└── package.json
```

---

## 13. Technologies Used

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.2.6 | Full-stack framework. App Router for the frontend. Standalone Node.js process for the WebSocket simulation server. |
| **TypeScript** | 5.x | Strict typing across all simulation logic, workers, stores, and components. Shared type definitions across the Node.js/browser boundary. |
| **Tailwind CSS** | 4.x | Utility-first styling. Dark theme throughout. |
| **React Leaflet** | 5.x + Leaflet 1.9 | Interactive map with OpenStreetMap tile layers. Renders vehicle markers, route polylines, and incident markers. |
| **OpenStreetMap / Overpass API** | — | Source of real road geometry for Tirana. Queried by `scripts/generateRoads.ts` via HTTP POST. |
| **ws** | 8.20.1 | WebSocket server. Streams simulation snapshots from Node.js to the browser at each tick. |
| **Node.js worker_threads** | Built-in | True OS threads for parallel vehicle processing, route strategy evaluation, and benchmark workloads. |
| **tsx** | 4.x | TypeScript execution hook for worker thread files. Allows type-safe workers without a separate compile step. |
| **Zustand** | 5.x | Lightweight reactive state management. Stores are thin bridges between WebSocket service and React components — no simulation logic inside. |
| **Recharts** | 3.x | Bar charts in the benchmark panel and performance chart. |
| **lucide-react** | Latest | Icon set used throughout the UI panels. |
| **concurrently** | 9.x | Runs Next.js dev server and WebSocket simulation server in parallel with `npm run dev:all`. |

---

## 14. Academic Relevance

This project implements and measures several core parallel programming concepts in a realistic applied context.

### Shared-Memory Parallelism

Node.js worker threads share no heap by default — data is serialized via `postMessage`. The programming model mirrors shared-memory parallelism in that workers receive read-only copies of graph data and operate independently. The project demonstrates why immutability is essential for parallel correctness: if workers mutated the shared edge array, race conditions would corrupt cost calculations.

### Task Parallelism vs Data Parallelism

- **Data parallelism**: `ParallelExecutor` applies the same function (`moveVehicleOnGraph`) to independent data partitions — the vehicle array split evenly across 4 workers.
- **Task parallelism**: `EmergencyRouter` dispatches different tasks (different A* strategy computations) to different workers. Each worker applies a different weight transformation and searches independently.

The benchmark uses both simultaneously: different candidate chunks (data partitioning) × all 4 strategies per chunk (task diversity).

### Performance Measurement and Amdahl's Law

All measurements use `performance.now()` with sub-millisecond precision. Workers are pre-warmed (spawned once per benchmark phase) to separate startup overhead from steady-state throughput. The resulting efficiency values (typically 0.5–0.8 for 4 workers) demonstrate Amdahl's Law empirically — not all of the sequential work is parallelisable, and the sequential bottlenecks (task generation, result merging, IPC) limit the achievable speedup.

### Real-World Application Domain

Emergency response time optimization is an active area of research in smart city infrastructure. The simulation model — dynamic edge weights, multi-criteria route selection, incident-triggered re-planning, and priority signal control — mirrors real Computer-Aided Dispatch (CAD) systems. Parallel processing of candidate routes is directly applicable to scenarios where a dispatch centre must evaluate paths for multiple emergency vehicles simultaneously under time pressure.

---

## 15. Future Improvements

| Improvement | Description |
|---|---|
| **Real traffic API** | Integrate live traffic data (e.g., HERE or TomTom) to update edge congestion from real sensor feeds instead of the current sinusoidal model. |
| **Multi-ambulance dispatch** | Support multiple simultaneous emergency vehicles with independent dispatch states and route tracking. |
| **MPI-style distributed zones** | Partition the city into geographic zones processed by separate Node.js processes communicating via IPC, simulating distributed-memory parallelism. |
| **GPU route scoring** | Evaluate hundreds of thousands of candidate routes using WebGPU compute shaders for massive throughput benchmarks. |
| **Machine learning ETA prediction** | Train a model on historical route costs and traffic patterns to predict ETA more accurately than the current A* cost sum. |
| **Larger city support** | Extend the Overpass query to cover full Tirana or other cities. Test scalability with 50,000+ node graphs. |
| **Real emergency dispatch data** | Integrate with open datasets from emergency services to validate simulation accuracy against real-world response times. |
| **Route visualization improvements** | Animate the ambulance path with turn-by-turn rendering and display the full set of evaluated strategy alternatives on the map. |
| **WebRTC peer simulation** | Allow multiple browser clients to run independent simulation nodes, exploring peer-to-peer distributed parallel simulation models. |

---

## Notes on Metric Integrity

All performance numbers shown in the UI and printed in the terminal are derived from direct `performance.now()` measurements:

- **Tick cost** in the live chart: measured from start to end of `tick_()`, separately per executor
- **Route compute time**: `performance.now()` before and after `router.findRouteBest()`
- **Benchmark throughput**: total measured milliseconds divided by total work completed
- **ETA remaining**: recomputed from remaining route edges and live edge costs on every tick

No values are hardcoded, interpolated, or estimated. If a displayed number looks surprising, it reflects the actual runtime behaviour of the simulation on that machine.

---

*City road data courtesy of [OpenStreetMap](https://openstreetmap.org) contributors, available under the [ODbL license](https://opendatacommons.org/licenses/odbl/).*
