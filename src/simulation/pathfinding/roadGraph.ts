import type { GeoPosition } from '../../types/simulation';

export interface RoadNode {
  id: string;
  position: GeoPosition;
  label?: string;
}

export interface RoadEdge {
  id: string;
  from: string;
  to: string;
  distanceM: number;
  baseSpeedKph: number;
  congestion: number;
  trafficLightDelayS: number;
  blocked: boolean;
  // Populated from OSM cache; absent in mock graph (fallback uses node positions)
  coordinates?: GeoPosition[];
  name?: string;
  roadType?: string;
}

export function edgeTravelCostS(edge: RoadEdge): number {
  if (edge.blocked) return Infinity;
  const baseTravelS = (edge.distanceM / 1000 / edge.baseSpeedKph) * 3600;
  // Congestion multiplier: 0 congestion = 1×, full congestion = 4×
  return baseTravelS * (1 + edge.congestion * 3) + edge.trafficLightDelayS;
}
