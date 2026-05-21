import type { GeoPosition } from './simulation';

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
