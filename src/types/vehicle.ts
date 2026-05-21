import type { GeoPosition } from './simulation';

export type VehicleType = 'car' | 'truck' | 'motorcycle' | 'emergency';
export type VehicleStatus = 'moving' | 'stopped' | 'waiting' | 'responding';

export interface Vehicle {
  id: string;
  type: VehicleType;
  status: VehicleStatus;
  position: GeoPosition;
  speed: number;
  heading: number;
  routeId: string | null;
}

export interface EmergencyVehicle extends Vehicle {
  type: 'emergency';
  priority: number;
  targetPosition: GeoPosition;
  responseTimeMs: number;
}
