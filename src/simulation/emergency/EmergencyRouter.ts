import { Worker } from 'worker_threads';
import { join } from 'path';
import type { RoadNode, RoadEdge } from '../pathfinding/roadGraph';
import { aStar } from '../pathfinding/aStar';
import type { PathResult } from '../pathfinding/aStar';
import type { RoutingResult, RouteStrategy } from '../../types/emergency';
import type { SimulationMode } from '../../types/simulation';

const STRATEGIES: RouteStrategy[] = [
  'standard',
  'avoid-congestion',
  'avoid-blocked',
  'prefer-speed',
];

export class EmergencyRouter {
  private readonly nodes: Map<string, RoadNode>;
  private readonly edges: Map<string, RoadEdge>;

  constructor(nodes: RoadNode[], edges: RoadEdge[]) {
    this.nodes = new Map(nodes.map((n) => [n.id, { ...n }]));
    this.edges = new Map(edges.map((e) => [e.id, { ...e }]));
  }

  updateCongestion(updates: { edgeId: string; congestion: number }[]): void {
    for (const { edgeId, congestion } of updates) {
      const edge = this.edges.get(edgeId);
      if (edge) edge.congestion = Math.max(0, Math.min(1, congestion));
    }
  }

  async findRouteBest(
    startId: string,
    goalId: string,
    mode: SimulationMode,
  ): Promise<RoutingResult> {
    const now = Date.now();

    // Sequential baseline is always measured for the benchmark comparison
    const seqStart = performance.now();
    const seqResult = this.runStrategy(startId, goalId, 'standard');
    const seqMs = performance.now() - seqStart;

    if (mode === 'sequential') {
      return toRoutingResult(seqResult, 'standard', seqMs, seqMs, null, null, 'sequential', now);
    }

    // Parallel: evaluate all 4 strategies simultaneously in separate workers
    const parStart = performance.now();
    const parallelOutcomes = await this.runParallelStrategies(startId, goalId);
    const parMs = performance.now() - parStart;

    const best = parallelOutcomes
      .filter((o) => o.result.found)
      .sort((a, b) => a.result.totalCostS - b.result.totalCostS)[0];

    const chosen = best ?? { result: seqResult, strategy: 'standard' as RouteStrategy };
    const totalEvaluated = parallelOutcomes.reduce((s, o) => s + o.result.roadsEvaluated, 0);
    const speedup = parseFloat((seqMs / Math.max(0.001, parMs)).toFixed(2));

    return {
      ...toRoutingResult(chosen.result, chosen.strategy, parMs, seqMs, parMs, speedup, 'parallel', now),
      roadsEvaluated: totalEvaluated,
    };
  }

  private runStrategy(startId: string, goalId: string, strategy: RouteStrategy): PathResult {
    const edges = applyStrategy(Array.from(this.edges.values()), strategy);
    const adjacency = buildAdjacency(edges);
    return aStar(this.nodes, adjacency, startId, goalId);
  }

  private async runParallelStrategies(
    startId: string,
    goalId: string,
  ): Promise<{ strategy: RouteStrategy; result: PathResult }[]> {
    const nodesArr = Array.from(this.nodes.values());
    const edgesArr = Array.from(this.edges.values()).map((e) => ({ ...e }));
    const workerPath = join(process.cwd(), 'src/workers/routingWorker.ts');

    return Promise.all(
      STRATEGIES.map(
        (strategy) =>
          new Promise<{ strategy: RouteStrategy; result: PathResult }>((resolve) => {
            const worker = new Worker(workerPath, { execArgv: ['--import', 'tsx'] });

            const onMessage = (result: PathResult) => {
              worker.off('error', onError);
              worker.terminate();
              resolve({ strategy, result });
            };
            const onError = () => {
              worker.off('message', onMessage);
              worker.terminate();
              resolve({
                strategy,
                result: { found: false, nodeIds: [], waypoints: [], totalCostS: Infinity, totalDistanceM: 0, roadsEvaluated: 0 },
              });
            };

            worker.once('message', onMessage);
            worker.once('error', onError);
            worker.postMessage({ nodes: nodesArr, edges: edgesArr, startId, goalId, strategy });
          }),
      ),
    );
  }
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

function toRoutingResult(
  path: PathResult,
  strategy: RouteStrategy,
  routingComputationMs: number,
  sequentialMs: number,
  parallelMs: number | null,
  speedupFactor: number | null,
  mode: SimulationMode,
  triggeredAt: number,
): RoutingResult {
  return {
    found: path.found,
    waypoints: path.waypoints,
    nodeIds: path.nodeIds,
    totalCostS: path.totalCostS,
    totalDistanceM: path.totalDistanceM,
    estimatedTravelTimeS: path.totalCostS,
    roadsEvaluated: path.roadsEvaluated,
    routingComputationMs,
    sequentialMs,
    parallelMs,
    speedupFactor,
    strategy,
    mode,
    triggeredAt,
  };
}
