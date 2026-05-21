import type { VehicleMarkerData } from '../../types/map';

export interface ExecutorResult {
  vehicles: VehicleMarkerData[];
  durationMs: number;
}

export class SequentialExecutor {
  execute(vehicles: VehicleMarkerData[], tick: number): ExecutorResult {
    const start = performance.now();
    const updated = vehicles.map((v) => moveVehicle(v, tick));
    return { vehicles: updated, durationMs: performance.now() - start };
  }
}

export function moveVehicle(vehicle: VehicleMarkerData, tick: number): VehicleMarkerData {
  if (vehicle.isEmergency) return vehicle;
  const jitter = 0.000025;
  const seed = vehicle.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const angle = (tick * 0.08 + seed * 0.37) % (Math.PI * 2);
  return {
    ...vehicle,
    position: {
      lat: vehicle.position.lat + Math.sin(angle) * jitter,
      lng: vehicle.position.lng + Math.cos(angle) * jitter,
    },
  };
}
