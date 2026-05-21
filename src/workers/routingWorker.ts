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
}

function applyStrategy(edges: RoadEdge[], strategy: RouteStrategy): RoadEdge[] {
  switch (strategy) {
    case 'avoid-congestion':
      return edges.map((e) => ({
        ...e,
        congestion: Math.min(1, e.congestion * 2),
        trafficLightDelayS: e.trafficLightDelayS * 1.5,
      }));
    case 'avoid-blocked':
      return edges.filter((e) => !e.blocked);
    case 'prefer-speed':
      return edges.map((e) => ({
        ...e,
        trafficLightDelayS: 0,
        congestion: e.congestion * 0.5,
      }));
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

parentPort?.on('message', ({ nodes, edges, startId, goalId, strategy }: WorkerMessage) => {
  const nodesMap = new Map<string, RoadNode>(nodes.map((n) => [n.id, n]));
  const stratEdges = applyStrategy(edges, strategy);
  const adjacency = buildAdjacency(stratEdges);
  const result: PathResult = aStar(nodesMap, adjacency, startId, goalId);
  parentPort?.postMessage(result);
});
