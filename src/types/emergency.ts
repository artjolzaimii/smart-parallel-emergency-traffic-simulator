import type { GeoPosition, SimulationMode } from './simulation';

export type RouteStrategy = 'standard' | 'avoid-congestion' | 'avoid-blocked' | 'prefer-speed';

export interface RoutingResult {
  found: boolean;
  waypoints: GeoPosition[];
  nodeIds: string[];
  totalCostS: number;
  totalDistanceM: number;
  estimatedTravelTimeS: number;
  roadsEvaluated: number;
  routingComputationMs: number;
  sequentialMs: number;
  parallelMs: number | null;
  speedupFactor: number | null;
  strategy: RouteStrategy;
  mode: SimulationMode;
  triggeredAt: number;
}

export type EmergencyType = 'fire' | 'medical' | 'police' | 'accident';
export type EmergencyPriority = 1 | 2 | 3;

export interface EmergencyEvent {
  id: string;
  type: EmergencyType;
  priority: EmergencyPriority;
  location: GeoPosition;
  dispatchedAt: number;
  resolvedAt: number | null;
  assignedVehicleIds: string[];
  estimatedResponseMs: number;
}

export interface EmergencyRoute {
  eventId: string;
  vehicleId: string;
  waypoints: GeoPosition[];
  preemptedLightIds: string[];
  estimatedArrivalMs: number;
}
