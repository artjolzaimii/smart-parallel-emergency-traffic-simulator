import { Worker } from 'worker_threads';
import { join } from 'path';
import type { LoadedGraph } from '../pathfinding/loadRoadGraph';
import type { RoadNode, RoadEdge } from '../pathfinding/roadGraph';
import { aStar } from '../pathfinding/aStar';
import type { RouteStrategy } from '../../types/emergency';
import type { BenchmarkMode, BenchmarkRunResult, FullBenchmarkResult } from '../../types/benchmark';

const WORKER_COUNT = 4;
const STRATEGIES: RouteStrategy[] = [
  'standard',
  'avoid-congestion',
  'avoid-blocked',
  'prefer-speed',
];

interface ScoringTask {
  fromNodeId: string;
  toNodeId: string;
}

// ─── BenchmarkRunner ──────────────────────────────────────────────────────────
//
// Workload: multi-strategy route optimization.
//
// For each candidate pair (fromNode → toNode) the scorer runs A* under all 4
// route strategies. That is O(V log V) per strategy per candidate — genuine
// CPU work with no I/O, no shared mutable state, and no coordination between
// candidates, making it embarrassingly parallel.
//
// Sequential: iterate over every candidate × strategy in one thread.
// Parallel:   split candidates equally across WORKER_COUNT persistent workers
//             (spawned once per run, reused across iterations to amortize
//              startup cost honestly).

export class BenchmarkRunner {
  constructor(private readonly graph: LoadedGraph) {}

  async run(
    candidateCount: number,
    iterationCount: number,
    mode: BenchmarkMode,
    onProgress: (pct: number) => void,
  ): Promise<FullBenchmarkResult> {
    const tasks = generateTasks(candidateCount, this.graph);
    // Strip edge geometry — A* only needs cost fields; omitting coordinates
    // reduces serialization overhead and keeps the wire cost honest.
    const slimEdges = slimifyEdges(this.graph.edges);
    const nodes = Array.from(this.graph.nodesMap.values()).map((n) => ({
      id: n.id,
      position: n.position,
    })) as RoadNode[];

    let seqResult: BenchmarkRunResult | null = null;
    let parResult: BenchmarkRunResult | null = null;

    // ─── Sequential phase ────────────────────────────────────────────────────
    if (mode === 'sequential' || mode === 'comparison') {
      const seqStart = performance.now();

      for (let iter = 0; iter < iterationCount; iter++) {
        runSequential(tasks, this.graph.nodesMap, slimEdges);
        onProgress(
          Math.round(((iter + 1) / iterationCount) * (mode === 'comparison' ? 50 : 100)),
        );
      }

      const seqMs = performance.now() - seqStart;

      seqResult = {
        mode: 'sequential',
        candidateCount,
        iterationCount,
        totalMs: round(seqMs, 2),
        avgIterationMs: round(seqMs / iterationCount, 3),
        throughputCandidatesPerSec: Math.round((candidateCount * iterationCount * 1000) / seqMs),
        workerCount: 0,
      };
    }

    // ─── Parallel phase ──────────────────────────────────────────────────────
    if (mode === 'parallel' || mode === 'comparison') {
      const baseProgress = mode === 'comparison' ? 50 : 0;
      const chunkSize = Math.ceil(tasks.length / WORKER_COUNT);
      const chunks = Array.from({ length: WORKER_COUNT }, (_, i) =>
        tasks.slice(i * chunkSize, (i + 1) * chunkSize),
      ).filter((c) => c.length > 0);

      const workerPath = join(process.cwd(), 'src/workers/routeScoringWorker.ts');
      // Spawn workers once and reuse across iterations so startup cost is
      // amortised the same way a real worker pool would be.
      const workers = chunks.map(
        () => new Worker(workerPath, { execArgv: ['--import', 'tsx'] }),
      );

      const parStart = performance.now();
      try {
        for (let iter = 0; iter < iterationCount; iter++) {
          await Promise.all(
            chunks.map(
              (chunk, wi) =>
                new Promise<void>((resolve, reject) => {
                  const w = workers[wi];
                  const onMsg = () => { w.off('error', onErr); resolve(); };
                  const onErr = (e: Error) => { w.off('message', onMsg); reject(e); };
                  w.once('message', onMsg);
                  w.once('error', onErr);
                  w.postMessage({ tasks: chunk, nodes, edges: slimEdges });
                }),
            ),
          );
          onProgress(
            baseProgress +
              Math.round(((iter + 1) / iterationCount) * (mode === 'comparison' ? 50 : 100)),
          );
        }
      } finally {
        for (const w of workers) w.terminate();
      }

      const parMs = performance.now() - parStart;

      parResult = {
        mode: 'parallel',
        candidateCount,
        iterationCount,
        totalMs: round(parMs, 2),
        avgIterationMs: round(parMs / iterationCount, 3),
        throughputCandidatesPerSec: Math.round((candidateCount * iterationCount * 1000) / parMs),
        workerCount: WORKER_COUNT,
      };
    }

    // ─── Derived metrics ─────────────────────────────────────────────────────
    let speedup: number | null = null;
    let efficiency: number | null = null;
    let improvementPct: number | null = null;

    if (seqResult && parResult) {
      speedup        = round(seqResult.totalMs / Math.max(0.001, parResult.totalMs), 3);
      efficiency     = round(speedup / WORKER_COUNT, 3);
      improvementPct = round((1 - parResult.totalMs / Math.max(0.001, seqResult.totalMs)) * 100, 1);
    }

    return {
      candidateCount,
      iterationCount,
      mode,
      sequential: seqResult,
      parallel: parResult,
      speedup,
      efficiency,
      improvementPct,
      timestamp: Date.now(),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runSequential(
  tasks: ScoringTask[],
  nodesMap: Map<string, RoadNode>,
  edges: RoadEdge[],
): void {
  for (const task of tasks) {
    for (const strategy of STRATEGIES) {
      const stratEdges = applyStrategy(edges, strategy);
      const adj = buildAdjacency(stratEdges);
      aStar(nodesMap, adj, task.fromNodeId, task.toNodeId);
    }
  }
}

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

function slimifyEdges(edges: RoadEdge[]): RoadEdge[] {
  return edges.map(({ id, from, to, distanceM, baseSpeedKph, congestion, trafficLightDelayS, blocked }) => ({
    id, from, to, distanceM, baseSpeedKph, congestion, trafficLightDelayS, blocked,
  }));
}

function generateTasks(count: number, graph: LoadedGraph): ScoringTask[] {
  const nodeIds = graph.nodes
    .map((n) => n.id)
    .filter((id) => (graph.adjacency[id]?.length ?? 0) > 0);

  if (nodeIds.length < 2) return [];

  const len = nodeIds.length;
  const tasks: ScoringTask[] = [];
  const rng = mulberry32(0xdeadbeef);

  for (let i = 0; i < count; i++) {
    const fromIdx = Math.floor(rng() * len);
    const toOffset = 1 + Math.floor(rng() * (len - 1));
    const toIdx = (fromIdx + toOffset) % len;
    tasks.push({ fromNodeId: nodeIds[fromIdx], toNodeId: nodeIds[toIdx] });
  }
  return tasks;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(n: number, decimals: number): number {
  return parseFloat(n.toFixed(decimals));
}
