import type { VehicleMarkerData } from '../../types/map';
import type { RoadEdge } from '../pathfinding/roadGraph';
import type { GeoPosition } from '../../types/simulation';
import type { VehicleGraphState } from './VehicleGraphState';

const SPEED_FACTORS: Record<string, number> = {
  car: 1.0,
  truck: 0.65,
  motorcycle: 1.2,
  emergency: 0.0, // ambulance stays at start node; routing manages its path
};

export function interpolateEdge(edge: RoadEdge, progress: number): GeoPosition {
  const coords = edge.coordinates;
  if (!coords || coords.length === 0) return { lat: 0, lng: 0 };
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];
  const t = progress * (coords.length - 1);
  const lo = Math.floor(t);
  const hi = Math.min(lo + 1, coords.length - 1);
  const frac = t - lo;
  return {
    lat: coords[lo].lat + (coords[hi].lat - coords[lo].lat) * frac,
    lng: coords[lo].lng + (coords[hi].lng - coords[lo].lng) * frac,
  };
}

export function moveVehicleOnGraph(
  vehicle: VehicleMarkerData,
  state: VehicleGraphState,
  edgesMap: Map<string, RoadEdge>,
  adjacency: Record<string, string[]>,
): { vehicle: VehicleMarkerData; state: VehicleGraphState } {
  if (vehicle.isEmergency) return { vehicle, state };

  const edge = edgesMap.get(state.edgeId);
  if (!edge || !edge.coordinates || edge.coordinates.length < 2) {
    return { vehicle, state };
  }

  const speedFactor = SPEED_FACTORS[vehicle.type] ?? 1.0;
  const effectiveKph = edge.baseSpeedKph * (1 - edge.congestion * 0.7) * speedFactor;
  const speedMps = effectiveKph / 3.6;
  const progressPerTick = speedMps / Math.max(1, edge.distanceM);

  let progress = state.progress + progressPerTick;
  let edgeId = state.edgeId;

  if (progress >= 1.0) {
    const nextIds = adjacency[edge.to] ?? [];
    if (nextIds.length > 0) {
      edgeId = nextIds[Math.floor(Math.random() * nextIds.length)];
    } else {
      // Dead-end node: pick any edge (keeps vehicle alive on the network)
      const allIds = Object.values(adjacency).flat();
      edgeId = allIds[Math.floor(Math.random() * allIds.length)] ?? state.edgeId;
    }
    progress = Math.max(0, progress - 1.0);
  }

  const nextEdge = edgesMap.get(edgeId) ?? edge;
  const position = interpolateEdge(nextEdge, Math.min(1, progress));

  return {
    vehicle: { ...vehicle, position },
    state: { id: state.id, edgeId, progress },
  };
}
