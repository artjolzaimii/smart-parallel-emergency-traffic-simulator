/**
 * Heavy Dispatch Worker — Parallel Advantage Scenario
 *
 * Stateful two-phase protocol:
 *
 *   Phase 1 — INIT (once per pool lifecycle)
 *   Parent → Worker: { type: 'init', nodes: SlimNode[], edges: SlimEdge[] }
 *   Worker → Parent: { type: 'ready' }
 *   Worker caches adjacency maps per strategy — no rebuild on subsequent calls.
 *
 *   Phase 2 — COMPUTE (once per route optimization request)
 *   Parent → Worker: { type: 'compute', tasks: DispatchTask[], targetFromId, targetToId }
 *   Worker → Parent: HeavyWorkerOutput
 *   Worker uses cached adjacency — IPC payload is only the task chunk (~KB).
 *
 * The stateful design eliminates repeated graph serialisation overhead that
 * caused sequential to win with small workloads.
 */
import { parentPort } from 'worker_threads';
import { aStar } from '../simulation/pathfinding/aStar';
import type { RoadNode, RoadEdge } from '../simulation/pathfinding/roadGraph';
import type { RouteStrategy } from '../types/emergency';

// ─── Wire types ───────────────────────────────────────────────────────────────

interface DispatchTask {
  fromNodeId: string;
  toNodeId: string;
}

export interface HeavyWorkerInput {
  type: 'init' | 'compute';
  // init only
  nodes?: Pick<RoadNode, 'id' | 'position'>[];
  edges?: RoadEdge[];
  // compute only
  tasks?: DispatchTask[];
  targetFromId?: string;
  targetToId?: string;
}

export interface HeavyWorkerOutput {
  /** Best strategy found for (targetFromId → targetToId). Null if no path. */
  bestStrategy: RouteStrategy | null;
  /** Route cost under bestStrategy. Infinity when not found. */
  bestCostS: number;
  /** Total A* evaluations performed (tasks × strategies). */
  scored: number;
  /** Wall-clock time inside the worker (excludes IPC). */
  durationMs: number;
}

// ─── Strategy helpers ─────────────────────────────────────────────────────────

const STRATEGIES: RouteStrategy[] = [
  'standard',
  'avoid-congestion',
  'avoid-blocked',
  'prefer-speed',
];

function applyStrategy(edges: RoadEdge[], strategy: RouteStrategy): RoadEdge[] {
  switch (strategy) {
    case 'avoid-congestion':
      return edges.map((e) => ({ ...e, congestion: Math.min(1, e.congestion * 2) }));
    case 'avoid-blocked':
      return edges.filter((e) => !e.blocked);
    case 'prefer-speed':
      return edges.map((e) => ({ ...e, trafficLightDelayS: 0, congestion: e.congestion * 0.5 }));
    default:
      return edges;
  }
}

function buildAdjacency(edges: RoadEdge[]): Map<string, RoadEdge[]> {
  const adj = new Map<string, RoadEdge[]>();
  for (const edge of edges) {
    let list = adj.get(edge.from);
    if (!list) { list = []; adj.set(edge.from, list); }
    list.push(edge);
  }
  return adj;
}

// ─── Cached graph state (populated on 'init') ─────────────────────────────────

let nodesMap: Map<string, RoadNode> | null = null;
let adjPerStrategy: Map<RouteStrategy, Map<string, RoadEdge[]>> | null = null;

// ─── Message handler ──────────────────────────────────────────────────────────

parentPort?.on('message', (msg: HeavyWorkerInput) => {
  // ── INIT ─────────────────────────────────────────────────────────────────
  if (msg.type === 'init') {
    const { nodes = [], edges = [] } = msg;

    // Build and cache the node lookup
    nodesMap = new Map<string, RoadNode>(nodes.map((n) => [n.id, n as RoadNode]));

    // Pre-build and cache adjacency per strategy — the expensive part done once
    adjPerStrategy = new Map<RouteStrategy, Map<string, RoadEdge[]>>();
    for (const strategy of STRATEGIES) {
      adjPerStrategy.set(strategy, buildAdjacency(applyStrategy(edges, strategy)));
    }

    parentPort?.postMessage({ type: 'ready' });
    return;
  }

  // ── COMPUTE ───────────────────────────────────────────────────────────────
  if (msg.type === 'compute') {
    if (!nodesMap || !adjPerStrategy) {
      // Not yet initialised — return an empty result
      const out: HeavyWorkerOutput = {
        bestStrategy: null, bestCostS: Infinity, scored: 0, durationMs: 0,
      };
      parentPort?.postMessage(out);
      return;
    }

    const { tasks = [], targetFromId = '', targetToId = '' } = msg;
    const t0 = performance.now();

    let bestStrategy: RouteStrategy | null = null;
    let bestCostS = Infinity;
    let scored = 0;

    for (const task of tasks) {
      const isTarget = task.fromNodeId === targetFromId && task.toNodeId === targetToId;
      for (const strategy of STRATEGIES) {
        const adj = adjPerStrategy.get(strategy)!;
        const result = aStar(nodesMap, adj, task.fromNodeId, task.toNodeId);
        scored++;
        if (isTarget && result.found && result.totalCostS < bestCostS) {
          bestCostS = result.totalCostS;
          bestStrategy = strategy;
        }
      }
    }

    const out: HeavyWorkerOutput = {
      bestStrategy,
      bestCostS,
      scored,
      durationMs: performance.now() - t0,
    };
    parentPort?.postMessage(out);
  }
});
