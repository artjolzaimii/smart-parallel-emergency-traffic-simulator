/**
 * HeavyDispatchWorkerPool
 *
 * Manages a pool of persistent worker threads for the Parallel Advantage
 * Scenario.  Workers are spawned once, initialised with the slim graph
 * (nodes + edges without coordinate arrays), and kept alive for the full
 * duration of the scenario so that:
 *
 *   1. tsx compilation cost is paid once (not on every routing call).
 *   2. Adjacency maps are pre-built in each worker and cached in memory.
 *   3. Each compute call sends only a small task-chunk (~KB IPC payload).
 *
 * This directly addresses the root cause of sequential winning: previously,
 * spawning 4 workers on every call added ~100-200 ms overhead that dwarfed
 * the actual computation, so sequential (no spawn) appeared faster.
 *
 * Usage:
 *   const pool = new HeavyDispatchWorkerPool();
 *   await pool.initialize(nodes, edges);   // once — graph cached in workers
 *   const outputs = await pool.compute(tasks, startId, goalId);
 *   pool.terminate();                       // scenario done or server shutdown
 */
import { Worker } from 'worker_threads';
import { join } from 'path';
import type { RoadNode, RoadEdge } from '../pathfinding/roadGraph';
import type { HeavyWorkerOutput } from '../../workers/heavyDispatchWorker';
import type { RouteStrategy } from '../../types/emergency';

const WORKER_COUNT = 4;
const WORKER_PATH = join(process.cwd(), 'src/workers/heavyDispatchWorker.ts');

interface DispatchTask {
  fromNodeId: string;
  toNodeId: string;
}

export class HeavyDispatchWorkerPool {
  private workers: Worker[] = [];
  private _initialized = false;

  get isInitialized(): boolean { return this._initialized; }

  /**
   * Spawn workers and send them the slim graph.
   * Workers build adjacency per strategy and cache it — subsequent compute
   * calls only pay for the A* work itself (no re-serialisation).
   */
  async initialize(
    nodes: Pick<RoadNode, 'id' | 'position'>[],
    edges: RoadEdge[],
  ): Promise<void> {
    // Terminate any pre-existing workers first (re-init safe)
    this.terminate();

    this.workers = Array.from({ length: WORKER_COUNT }, () =>
      new Worker(WORKER_PATH, { execArgv: ['--import', 'tsx'] }),
    );

    // Send init message to all workers concurrently; wait until all reply 'ready'
    await Promise.all(
      this.workers.map(
        (w) =>
          new Promise<void>((resolve, reject) => {
            const onMsg = (reply: { type?: string }) => {
              if (reply.type === 'ready') {
                w.off('error', onErr);
                resolve();
              }
            };
            const onErr = (err: Error) => {
              w.off('message', onMsg);
              reject(err);
            };
            w.once('message', onMsg);
            w.once('error', onErr);
            w.postMessage({ type: 'init', nodes, edges });
          }),
      ),
    );

    this._initialized = true;
    console.log(`[Advantage] workerPool=initialized workers=${WORKER_COUNT} graphCachedInWorkers=true`);
  }

  /**
   * Split tasks across workers and run them concurrently.
   * Only task chunks are sent over IPC — the graph is already cached.
   *
   * Returns the raw outputs from each worker.  The caller is responsible
   * for picking the best route result.
   */
  async compute(
    tasks: DispatchTask[],
    targetFromId: string,
    targetToId: string,
  ): Promise<{ outputs: HeavyWorkerOutput[]; workerCount: number }> {
    if (!this._initialized || this.workers.length === 0) {
      throw new Error('[HeavyDispatchWorkerPool] Pool not initialized — call initialize() first.');
    }

    const chunkSize = Math.ceil(tasks.length / this.workers.length);
    const chunks = Array.from({ length: this.workers.length }, (_, i) =>
      tasks.slice(i * chunkSize, (i + 1) * chunkSize),
    ).filter((c) => c.length > 0);

    const outputs = await Promise.all(
      chunks.map(
        (chunk, wi) =>
          new Promise<HeavyWorkerOutput>((resolve) => {
            const w = this.workers[wi];
            const onMsg = (out: HeavyWorkerOutput) => {
              w.off('error', onErr);
              resolve(out);
            };
            const onErr = () => {
              w.off('message', onMsg);
              // Worker errored — return empty result so other workers still count
              resolve({ bestStrategy: null, bestCostS: Infinity, scored: 0, durationMs: 0 });
            };
            w.once('message', onMsg);
            w.once('error', onErr);
            w.postMessage({ type: 'compute', tasks: chunk, targetFromId, targetToId });
          }),
      ),
    );

    return { outputs, workerCount: chunks.length };
  }

  /** Gracefully terminate all workers. Safe to call multiple times. */
  terminate(): void {
    for (const w of this.workers) {
      try { w.terminate(); } catch { /* ignore errors on already-dead workers */ }
    }
    this.workers = [];
    this._initialized = false;
  }
}

/** Best strategy + cost across a set of worker outputs. */
export function pickBestFromOutputs(
  outputs: HeavyWorkerOutput[],
): { strategy: RouteStrategy; costS: number } {
  let best: RouteStrategy = 'standard';
  let bestCost = Infinity;
  for (const o of outputs) {
    if (o.bestStrategy && o.bestCostS < bestCost) {
      bestCost = o.bestCostS;
      best = o.bestStrategy;
    }
  }
  return { strategy: best, costS: bestCost };
}
