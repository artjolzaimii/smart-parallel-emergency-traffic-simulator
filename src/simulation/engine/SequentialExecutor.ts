import type { VehicleMarkerData } from '../../types/map';
import type { RoadEdge } from '../pathfinding/roadGraph';
import type { VehicleGraphState } from '../vehicles/VehicleGraphState';
import { moveVehicleOnGraph } from '../vehicles/VehicleMovement';

export interface GraphContext {
  edgesMap: Map<string, RoadEdge>;
  adjacency: Record<string, string[]>;
}

export interface ExecutorResult {
  vehicles: VehicleMarkerData[];
  graphStates: VehicleGraphState[];
  durationMs: number;
}

export class SequentialExecutor {
  execute(
    vehicles: VehicleMarkerData[],
    graphStates: VehicleGraphState[],
    ctx: GraphContext,
  ): ExecutorResult {
    const start = performance.now();
    const stateMap = new Map(graphStates.map((s) => [s.id, s]));

    const results = vehicles.map((v) => {
      const state = stateMap.get(v.id);
      if (!state) return { vehicle: v, state: { id: v.id, edgeId: '', progress: 0 } };
      return moveVehicleOnGraph(v, state, ctx.edgesMap, ctx.adjacency);
    });

    return {
      vehicles: results.map((r) => r.vehicle),
      graphStates: results.map((r) => r.state),
      durationMs: performance.now() - start,
    };
  }
}
