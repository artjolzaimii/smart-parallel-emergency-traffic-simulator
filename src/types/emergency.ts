import type { GeoPosition, SimulationMode } from './simulation';

export type RouteStrategy = 'standard' | 'avoid-congestion' | 'avoid-blocked' | 'prefer-speed';

export type EmergencyDispatchStatus = 'idle' | 'routing' | 'active' | 'rerouting' | 'completed';

export interface DispatchState {
  status: EmergencyDispatchStatus;
  routeEdgeIds: string[];
  currentEdgeIndex: number;
  progressOnEdge: number;
  etaRemainingS: number;
  distanceRemainingM: number;
  startedAtTick: number;
  completedAt: number | null;
  totalResponseTimeS: number | null;
  reroutes: number;
  routeBlockedDetected: boolean;
  computeMs: number;
  workersUsed: number;
  selectedStrategy: string;
}

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
