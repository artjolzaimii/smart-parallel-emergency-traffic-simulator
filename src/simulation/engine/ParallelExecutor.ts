import { Worker } from 'worker_threads';
import { join } from 'path';
import type { VehicleMarkerData } from '../../types/map';
import type { RoadEdge } from '../pathfinding/roadGraph';
import type { VehicleGraphState } from '../vehicles/VehicleGraphState';
import type { ExecutorResult } from './SequentialExecutor';

const WORKER_COUNT = 4;

interface WorkerResult {
  vehicles: VehicleMarkerData[];
  graphStates: VehicleGraphState[];
}

export class ParallelExecutor {
  private readonly workers: Worker[];

  constructor() {
    const workerPath = join(process.cwd(), 'src/workers/vehicleWorker.ts');
    this.workers = Array.from({ length: WORKER_COUNT }, () =>
      new Worker(workerPath, { execArgv: ['--import', 'tsx'] }),
    );
  }

  async execute(
    vehicles: VehicleMarkerData[],
    graphStates: VehicleGraphState[],
    edges: RoadEdge[],
    adjacency: Record<string, string[]>,
  ): Promise<ExecutorResult> {
    const start = performance.now();

    const chunkSize = Math.ceil(vehicles.length / this.workers.length);
    const chunks: Array<{ vehicles: VehicleMarkerData[]; graphStates: VehicleGraphState[] }> = [];
    for (let i = 0; i < vehicles.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, vehicles.length);
      chunks.push({ vehicles: vehicles.slice(i, end), graphStates: graphStates.slice(i, end) });
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

  private dispatch(
    worker: Worker,
    task: {
      vehicles: VehicleMarkerData[];
      graphStates: VehicleGraphState[];
      edges: RoadEdge[];
      adjacency: Record<string, string[]>;
    },
  ): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      const onMessage = (result: WorkerResult) => {
        worker.off('error', onError);
        resolve(result);
      };
      const onError = (err: Error) => {
        worker.off('message', onMessage);
        reject(err);
      };
      worker.once('message', onMessage);
      worker.once('error', onError);
      worker.postMessage(task);
    });
  }

  terminate(): void {
    this.workers.forEach((w) => w.terminate());
  }
}
