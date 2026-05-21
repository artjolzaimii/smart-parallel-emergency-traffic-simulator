import { Worker } from 'worker_threads';
import { join } from 'path';
import type { VehicleMarkerData } from '../../types/map';
import type { ExecutorResult } from './SequentialExecutor';

const WORKER_COUNT = 4;

export class ParallelExecutor {
  private workers: Worker[];

  constructor() {
    const workerPath = join(process.cwd(), 'src/workers/vehicleWorker.ts');
    this.workers = Array.from({ length: WORKER_COUNT }, () =>
      new Worker(workerPath, { execArgv: ['--import', 'tsx'] }),
    );
  }

  async execute(vehicles: VehicleMarkerData[], tick: number): Promise<ExecutorResult> {
    const start = performance.now();

    const chunkSize = Math.ceil(vehicles.length / this.workers.length);
    const chunks: VehicleMarkerData[][] = [];
    for (let i = 0; i < vehicles.length; i += chunkSize) {
      chunks.push(vehicles.slice(i, Math.min(i + chunkSize, vehicles.length)));
    }

    const results = await Promise.all(
      chunks.map((chunk, i) =>
        this.dispatch(this.workers[i % this.workers.length], { vehicles: chunk, tick }),
      ),
    );

    return {
      vehicles: results.flatMap((r) => r.vehicles),
      durationMs: performance.now() - start,
    };
  }

  private dispatch(
    worker: Worker,
    task: { vehicles: VehicleMarkerData[]; tick: number },
  ): Promise<{ vehicles: VehicleMarkerData[] }> {
    return new Promise((resolve, reject) => {
      // Cross-remove handlers so neither accumulates after the other fires
      const onMessage = (result: { vehicles: VehicleMarkerData[] }) => {
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
