import type { RoadNode, RoadEdge } from './roadGraph';
import { edgeTravelCostS } from './roadGraph';
import { haversineM } from '../utils/geo';
import type { GeoPosition } from '../../types/simulation';

export interface PathResult {
  found: boolean;
  nodeIds: string[];
  waypoints: GeoPosition[];
  totalCostS: number;
  totalDistanceM: number;
  roadsEvaluated: number;
}

class MinHeap {
  private data: { priority: number; id: string }[] = [];

  push(priority: number, id: string): void {
    this.data.push({ priority, id });
    this.bubbleUp(this.data.length - 1);
  }

  pop(): string | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top.id;
  }

  get size(): number {
    return this.data.length;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].priority <= this.data[i].priority) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.data[l].priority < this.data[min].priority) min = l;
      if (r < n && this.data[r].priority < this.data[min].priority) min = r;
      if (min === i) break;
      [this.data[min], this.data[i]] = [this.data[i], this.data[min]];
      i = min;
    }
  }
}

export function aStar(
  nodes: Map<string, RoadNode>,
  adjacency: Map<string, RoadEdge[]>,
  startId: string,
  goalId: string,
): PathResult {
  const goal = nodes.get(goalId);
  if (!goal) {
    return { found: false, nodeIds: [], waypoints: [], totalCostS: 0, totalDistanceM: 0, roadsEvaluated: 0 };
  }

  // Admissible heuristic: straight-line time at max network speed (60 kph)
  const heuristic = (id: string): number => {
    const node = nodes.get(id);
    if (!node) return 0;
    return (haversineM(node.position, goal.position) / 1000 / 60) * 3600;
  };

  const gScore = new Map<string, number>([[startId, 0]]);
  const cameFrom = new Map<string, string>();
  const closed = new Set<string>();
  const heap = new MinHeap();
  let roadsEvaluated = 0;

  heap.push(heuristic(startId), startId);

  while (heap.size > 0) {
    const current = heap.pop()!;

    if (current === goalId) {
      return buildPath(goalId, cameFrom, nodes, gScore.get(goalId) ?? 0, roadsEvaluated);
    }

    if (closed.has(current)) continue;
    closed.add(current);

    for (const edge of adjacency.get(current) ?? []) {
      roadsEvaluated++;
      const cost = edgeTravelCostS(edge);
      if (!isFinite(cost)) continue;

      const tentative = (gScore.get(current) ?? Infinity) + cost;
      if (tentative < (gScore.get(edge.to) ?? Infinity)) {
        gScore.set(edge.to, tentative);
        cameFrom.set(edge.to, current);
        heap.push(tentative + heuristic(edge.to), edge.to);
      }
    }
  }

  return { found: false, nodeIds: [], waypoints: [], totalCostS: 0, totalDistanceM: 0, roadsEvaluated };
}

function buildPath(
  goalId: string,
  cameFrom: Map<string, string>,
  nodes: Map<string, RoadNode>,
  totalCostS: number,
  roadsEvaluated: number,
): PathResult {
  const nodeIds: string[] = [];
  let cur = goalId;
  while (cameFrom.has(cur)) {
    nodeIds.unshift(cur);
    cur = cameFrom.get(cur)!;
  }
  nodeIds.unshift(cur);

  const waypoints = nodeIds.map((id) => nodes.get(id)!.position);
  let totalDistanceM = 0;
  for (let i = 1; i < nodeIds.length; i++) {
    totalDistanceM += haversineM(
      nodes.get(nodeIds[i - 1])!.position,
      nodes.get(nodeIds[i])!.position,
    );
  }

  return { found: true, nodeIds, waypoints, totalCostS, totalDistanceM, roadsEvaluated };
}
