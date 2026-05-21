import { parentPort } from 'worker_threads';
import type { VehicleMarkerData } from '../types/map';
import { moveVehicle } from '../simulation/engine/SequentialExecutor';

interface WorkerTask {
  vehicles: VehicleMarkerData[];
  tick: number;
}

parentPort?.on('message', ({ vehicles, tick }: WorkerTask) => {
  const updated = vehicles.map((v) => moveVehicle(v, tick));
  parentPort?.postMessage({ vehicles: updated });
});
