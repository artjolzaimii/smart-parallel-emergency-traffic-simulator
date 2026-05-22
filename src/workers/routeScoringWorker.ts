import { parentPort } from 'worker_threads';
import { aStar } from '../simulation/pathfinding/aStar';
import type { RoadNode, RoadEdge } from '../simulation/pathfinding/roadGraph';
import type { RouteStrategy } from '../types/emergency';

interface ScoringTask {
  fromNodeId: string;
  toNodeId: string;
}

interface WorkerInput {
  tasks: ScoringTask[];
  nodes: RoadNode[];
  edges: RoadEdge[];
}

interface WorkerOutput {
  scored: number;
  durationMs: number;
}

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

parentPort?.on('message', ({ tasks, nodes, edges }: WorkerInput) => {
  const start = performance.now();
  const nodesMap = new Map<string, RoadNode>(nodes.map((n) => [n.id, n]));
  let scored = 0;

  for (const task of tasks) {
    for (const strategy of STRATEGIES) {
      const stratEdges = applyStrategy(edges, strategy);
      const adj = buildAdjacency(stratEdges);
      aStar(nodesMap, adj, task.fromNodeId, task.toNodeId);
      scored++;
    }
  }

  const result: WorkerOutput = {
    scored,
    durationMs: performance.now() - start,
  };
  parentPort?.postMessage(result);
});
