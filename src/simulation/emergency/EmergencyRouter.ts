import { Worker } from 'worker_threads';
import { join } from 'path';
import type { RoadNode, RoadEdge } from '../pathfinding/roadGraph';
import { aStar } from '../pathfinding/aStar';
import type { PathResult } from '../pathfinding/aStar';
import type { RoutingResult, RouteStrategy } from '../../types/emergency';
import type { SimulationMode } from '../../types/simulation';
import type { HeavyDispatchWorkerPool } from '../workers/HeavyDispatchWorkerPool';
import { pickBestFromOutputs } from '../workers/HeavyDispatchWorkerPool';

const STRATEGIES: RouteStrategy[] = [
  'standard',
  'avoid-congestion',
  'avoid-blocked',
  'prefer-speed',
];

export class EmergencyRouter {
  private readonly nodes: Map<string, RoadNode>;
  private readonly edges: Map<string, RoadEdge>;
  // Incident overrides sit on top of dynamic congestion
  private incidentOverrides: Map<string, { congestionBoost: number; blocked: boolean }> = new Map();

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

  applyIncidentOverrides(overrides: { edgeId: string; congestionBoost: number; blocked: boolean }[]): void {
    this.incidentOverrides.clear();
    for (const o of overrides) {
      this.incidentOverrides.set(o.edgeId, { congestionBoost: o.congestionBoost, blocked: o.blocked });
    }
  }

  // Current edge state including incident overrides — used for route cost monitoring
  getEdgesWithIncidents(): RoadEdge[] {
    return Array.from(this.edges.values()).map((edge) => {
      const inc = this.incidentOverrides.get(edge.id);
      if (!inc) return edge;
      return {
        ...edge,
        congestion: Math.min(1, edge.congestion + inc.congestionBoost),
        blocked: edge.blocked || inc.blocked,
      };
    });
  }

  // ─── Standard routing (normal mode) ──────────────────────────────────────

  async findRouteBest(
    startId: string,
    goalId: string,
    mode: SimulationMode,
  ): Promise<RoutingResult> {
    const now = Date.now();

    const seqStart = performance.now();
    const seqResult = this.runStrategy(startId, goalId, 'standard');
    const seqMs = performance.now() - seqStart;

    if (mode === 'sequential') {
      return toRoutingResult(seqResult, 'standard', seqMs, seqMs, null, null, 'sequential', now);
    }

    const parStart = performance.now();
    const parallelOutcomes = await this.runParallelStrategies(startId, goalId, 1);
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

  // ─── Separate seq / par routes for normal-mode comparison panel ──────────

  /** Compute only the sequential route (single A* in main thread). */
  async findRouteSequential(startId: string, goalId: string): Promise<{ result: RoutingResult; computeMs: number }> {
    const start = performance.now();
    const pathResult = this.runStrategy(startId, goalId, 'standard');
    const computeMs = performance.now() - start;
    return {
      result: toRoutingResult(pathResult, 'standard', computeMs, computeMs, null, null, 'sequential', Date.now()),
      computeMs,
    };
  }

  /** Compute the parallel route (4 worker threads, 4 strategies). */
  async findRouteParallel(startId: string, goalId: string): Promise<{ result: RoutingResult; computeMs: number }> {
    const seqMs = this.measureSingleAStarMs(startId, goalId);
    const start = performance.now();
    const outcomes = await this.runParallelStrategies(startId, goalId, 1);
    const computeMs = performance.now() - start;

    const best = outcomes.filter((o) => o.result.found).sort((a, b) => a.result.totalCostS - b.result.totalCostS)[0];
    const fallback = this.runStrategy(startId, goalId, 'standard');
    const chosen = best ?? { result: fallback, strategy: 'standard' as RouteStrategy };
    const speedup = parseFloat((seqMs / Math.max(0.001, computeMs)).toFixed(2));

    return {
      result: toRoutingResult(chosen.result, chosen.strategy, computeMs, seqMs, computeMs, speedup, 'parallel', Date.now()),
      computeMs,
    };
  }

  // ─── Heavy routing (Parallel Advantage Scenario) ─────────────────────────

  /**
   * Heavy-workload routing for the Parallel Advantage Scenario.
   *
   * @param candidateCount  How many route pairs to evaluate (Standard=500,
   *                        Heavy=1000, Extreme=2000).
   * @param pool            Pre-initialised HeavyDispatchWorkerPool.  Providing
   *                        this is what makes parallel genuinely faster: workers
   *                        already have the graph cached — only task chunks are
   *                        sent over IPC.  If omitted falls back to seq path.
   *
   * Both modes evaluate candidateCount × 4 strategies = same total A* work.
   * The difference is wall-clock time only (parallel splits work across CPUs).
   */
  async findRouteHeavy(
    startId: string,
    goalId: string,
    mode: 'sequential' | 'parallel',
    candidateCount: number,
    pool?: HeavyDispatchWorkerPool,
  ): Promise<{ result: RoutingResult; computeMs: number; totalEvaluations: number }> {
    const now = Date.now();
    const totalEvaluations = candidateCount * STRATEGIES.length;

    // Tasks are the same for both modes — identical workload, different execution
    const tasks = generateHeavyTasks(candidateCount, startId, goalId, this.nodes);

    // ── Sequential ────────────────────────────────────────────────────────────
    if (mode === 'sequential' || !pool?.isInitialized) {
      const slimEdges = slimifyEdges(this.getEdgesWithIncidents());
      const slimNodes = slimifyNodes(Array.from(this.nodes.values()));
      const nodesMap = new Map<string, RoadNode>(slimNodes.map((n) => [n.id, n as RoadNode]));

      // Pre-build adjacency per strategy once — reused across all candidates
      const adjPerStrategy = new Map<RouteStrategy, Map<string, RoadEdge[]>>();
      for (const strategy of STRATEGIES) {
        adjPerStrategy.set(strategy, buildAdjacency(applyStrategy(slimEdges, strategy)));
      }

      const t0 = performance.now();
      let bestStrategy: RouteStrategy = 'standard';
      let bestCostS = Infinity;

      for (const task of tasks) {
        const isTarget = task.fromNodeId === startId && task.toNodeId === goalId;
        for (const strategy of STRATEGIES) {
          const result = aStar(nodesMap, adjPerStrategy.get(strategy)!, task.fromNodeId, task.toNodeId);
          if (isTarget && result.found && result.totalCostS < bestCostS) {
            bestCostS = result.totalCostS;
            bestStrategy = strategy;
          }
        }
      }

      const computeMs = performance.now() - t0;
      console.log(
        `[Advantage] SEQ candidates=${candidateCount} strategies=4 ` +
        `totalEvaluations=${totalEvaluations} bestStrategy=${bestStrategy} computeMs=${computeMs.toFixed(1)}ms`,
      );

      // Re-run once with full geometry to recover proper road-shape waypoints
      const chosen = this.runStrategy(startId, goalId, bestStrategy);
      return {
        result: toRoutingResult(chosen, bestStrategy, computeMs, computeMs, null, null, 'sequential', now),
        computeMs,
        totalEvaluations,
      };
    }

    // ── Parallel (persistent pool) ────────────────────────────────────────────
    // Pool has the graph cached — only task chunks travel over IPC (~KB payload)
    const t0 = performance.now();
    const { outputs, workerCount } = await pool.compute(tasks, startId, goalId);
    const computeMs = performance.now() - t0;

    const { strategy: bestStrategy } = pickBestFromOutputs(outputs);
    const totalScored = outputs.reduce((s, o) => s + o.scored, 0);

    console.log(
      `[Advantage] PAR candidates=${candidateCount} strategies=4 ` +
      `totalEvaluations=${totalEvaluations} workers=${workerCount} scored=${totalScored} ` +
      `workerPool=reused bestStrategy=${bestStrategy} computeMs=${computeMs.toFixed(1)}ms`,
    );

    // Re-run once with full geometry to recover proper road-shape waypoints
    const chosen = this.runStrategy(startId, goalId, bestStrategy);
    return {
      result: toRoutingResult(chosen, bestStrategy, computeMs, computeMs, computeMs, null, 'parallel', now),
      computeMs,
      totalEvaluations,
    };
  }

  /** Return slim (coordinate-free) graph data for worker pool initialisation. */
  getSlimGraph(): {
    nodes: Pick<RoadNode, 'id' | 'position'>[];
    edges: RoadEdge[];
  } {
    return {
      nodes: slimifyNodes(Array.from(this.nodes.values())),
      edges: slimifyEdges(this.getEdgesWithIncidents()),
    };
  }

  // ─── Rerouting compute time comparison ───────────────────────────────────

  /** Measure how long sequential and parallel rerouting would each take from
   *  the given node. Returns both compute times without actually changing state. */
  async measureRerouteComputeTimes(
    fromNodeId: string,
    goalId: string,
  ): Promise<{ seqMs: number; parMs: number }> {
    const seqStart = performance.now();
    this.runStrategy(fromNodeId, goalId, 'standard');
    const seqMs = performance.now() - seqStart;

    const parStart = performance.now();
    await this.runParallelStrategies(fromNodeId, goalId, 1);
    const parMs = performance.now() - parStart;

    return { seqMs, parMs };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private runStrategy(startId: string, goalId: string, strategy: RouteStrategy): PathResult {
    const edges = applyStrategy(this.getEdgesWithIncidents(), strategy);
    const adjacency = buildAdjacency(edges);
    return aStar(this.nodes, adjacency, startId, goalId);
  }

  private measureSingleAStarMs(startId: string, goalId: string): number {
    const t = performance.now();
    this.runStrategy(startId, goalId, 'standard');
    return performance.now() - t;
  }

  private async runParallelStrategies(
    startId: string,
    goalId: string,
    heavyRuns: number,
  ): Promise<{ strategy: RouteStrategy; result: PathResult }[]> {
    const nodesArr = Array.from(this.nodes.values());
    const edgesArr = this.getEdgesWithIncidents().map((e) => ({ ...e }));
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
            worker.postMessage({ nodes: nodesArr, edges: edgesArr, startId, goalId, strategy, heavyRuns });
          }),
      ),
    );
  }
}

// ─── Strategy helpers ─────────────────────────────────────────────────────────

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

// ─── Heavy routing helpers ────────────────────────────────────────────────────

/** Strip edge coordinates — reduces IPC serialisation cost by ~70%. */
function slimifyEdges(edges: RoadEdge[]): RoadEdge[] {
  return edges.map(({ id, from, to, distanceM, baseSpeedKph, congestion, trafficLightDelayS, blocked }) => ({
    id, from, to, distanceM, baseSpeedKph, congestion, trafficLightDelayS, blocked,
  }));
}

/** Keep only id + position from nodes — enough for A* heuristic. */
function slimifyNodes(nodes: RoadNode[]): Pick<RoadNode, 'id' | 'position'>[] {
  return nodes.map(({ id, position }) => ({ id, position }));
}

/**
 * Generate `count` route evaluation tasks.
 * The first task is always startId→goalId (the actual ambulance route).
 * The rest are deterministic-random node pairs (seeded RNG for reproducibility).
 */
function generateHeavyTasks(
  count: number,
  startId: string,
  goalId: string,
  nodes: Map<string, RoadNode>,
): { fromNodeId: string; toNodeId: string }[] {
  const tasks: { fromNodeId: string; toNodeId: string }[] = [{ fromNodeId: startId, toNodeId: goalId }];
  const nodeIds = Array.from(nodes.keys());
  if (nodeIds.length < 2) return tasks;

  const rng = mulberry32(0xc0ffee42);
  while (tasks.length < count) {
    const fi = Math.floor(rng() * nodeIds.length);
    const offset = 1 + Math.floor(rng() * (nodeIds.length - 1));
    const ti = (fi + offset) % nodeIds.length;
    tasks.push({ fromNodeId: nodeIds[fi], toNodeId: nodeIds[ti] });
  }
  return tasks;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
