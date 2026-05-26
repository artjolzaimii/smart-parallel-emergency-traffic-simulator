import { parentPort } from 'worker_threads';
import { aStar } from '../simulation/pathfinding/aStar';
import type { RoadNode, RoadEdge } from '../simulation/pathfinding/roadGraph';
import type { PathResult } from '../simulation/pathfinding/aStar';
import type { RouteStrategy } from '../types/emergency';

interface WorkerMessage {
  nodes: RoadNode[];
  edges: RoadEdge[];
  startId: string;
  goalId: string;
  strategy: RouteStrategy;
  /** When > 1, run A* this many times with varied edge cost weights to simulate
   *  a heavier route-evaluation workload (used by Parallel Advantage Scenario). */
  heavyRuns?: number;
}

// Variant weight multipliers for heavy-mode iterations
const HEAVY_VARIANT_WEIGHTS = [1.0, 1.15, 0.85, 1.3];

function applyStrategy(edges: RoadEdge[], strategy: RouteStrategy, variantIndex = 0): RoadEdge[] {
  const cw = HEAVY_VARIANT_WEIGHTS[variantIndex % HEAVY_VARIANT_WEIGHTS.length];
  switch (strategy) {
    case 'avoid-congestion':
      return edges.map((e) => ({
        ...e,
        congestion: Math.min(1, e.congestion * 2 * cw),
        trafficLightDelayS: e.trafficLightDelayS * 1.5,
      }));
    case 'avoid-blocked':
      return edges.filter((e) => !e.blocked).map((e) => ({
        ...e,
        congestion: e.congestion * cw,
      }));
    case 'prefer-speed':
      return edges.map((e) => ({
        ...e,
        trafficLightDelayS: 0,
        congestion: e.congestion * 0.5 * cw,
      }));
    default:
      return edges.map((e) => ({
        ...e,
        congestion: e.congestion * cw,
      }));
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

parentPort?.on('message', ({ nodes, edges, startId, goalId, strategy, heavyRuns = 1 }: WorkerMessage) => {
  const nodesMap = new Map<string, RoadNode>(nodes.map((n) => [n.id, n]));
  let best: PathResult | null = null;

  // Run heavyRuns iterations with slightly different edge cost weights
  // This creates a realistic multi-candidate route evaluation workload
  for (let i = 0; i < heavyRuns; i++) {
    const stratEdges = applyStrategy(edges, strategy, i);
    const adjacency = buildAdjacency(stratEdges);
    const result: PathResult = aStar(nodesMap, adjacency, startId, goalId);
    if (!best || (result.found && result.totalCostS < (best.totalCostS ?? Infinity))) {
      best = result;
    }
  }

  const finalResult: PathResult = best ?? {
    found: false, nodeIds: [], waypoints: [], totalCostS: Infinity, totalDistanceM: 0, roadsEvaluated: 0,
  };
  parentPort?.postMessage(finalResult);
});
