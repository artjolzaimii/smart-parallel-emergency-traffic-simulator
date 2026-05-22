import { parentPort } from 'worker_threads';
import type { VehicleMarkerData } from '../types/map';
import type { RoadEdge } from '../simulation/pathfinding/roadGraph';
import type { VehicleGraphState } from '../simulation/vehicles/VehicleGraphState';
import { moveVehicleOnGraph } from '../simulation/vehicles/VehicleMovement';

interface WorkerTask {
  vehicles: VehicleMarkerData[];
  graphStates: VehicleGraphState[];
  edges: RoadEdge[];
  adjacency: Record<string, string[]>;
}

parentPort?.on('message', ({ vehicles, graphStates, edges, adjacency }: WorkerTask) => {
  const edgesMap = new Map(edges.map((e) => [e.id, e]));
  const stateMap = new Map(graphStates.map((s) => [s.id, s]));

  const results = vehicles.map((v) => {
    const state = stateMap.get(v.id);
    if (!state) return { vehicle: v, state: { id: v.id, edgeId: '', progress: 0 } };
    return moveVehicleOnGraph(v, state, edgesMap, adjacency);
  });

  parentPort?.postMessage({
    vehicles: results.map((r) => r.vehicle),
    graphStates: results.map((r) => r.state),
  });
});
