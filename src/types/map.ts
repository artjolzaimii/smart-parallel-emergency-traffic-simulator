import type { GeoPosition } from './simulation';
import type { VehicleType } from './vehicle';
import type { TrafficLightPhase } from './traffic';

export interface VehicleMarkerData {
  id: string;
  type: VehicleType;
  isEmergency: boolean;
  position: GeoPosition;
  label?: string;
}

export interface TrafficLightMarkerData {
  id: string;
  position: GeoPosition;
  phase: TrafficLightPhase;
}

export interface CongestionSegmentData {
  id: string;
  points: GeoPosition[];
  density: number;
  label?: string;
}

export interface EmergencyRouteData {
  id: string;
  vehicleId: string;
  waypoints: GeoPosition[];
}

export interface MapViewConfig {
  center: GeoPosition;
  zoom: number;
}
