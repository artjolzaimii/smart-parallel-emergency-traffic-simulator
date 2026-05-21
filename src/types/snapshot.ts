import type { SimulationStatus, SimulationConfig } from './simulation';
import type {
  VehicleMarkerData,
  TrafficLightMarkerData,
  CongestionSegmentData,
  EmergencyRouteData,
} from './map';
import type { PerformanceMetrics, BenchmarkComparison } from './metrics';
import type { RoutingResult } from './emergency';
import type { Incident } from './incident';

export interface SimulationSnapshot {
  tick: number;
  elapsedMs: number;
  status: SimulationStatus;
  config: SimulationConfig;
  vehicles: VehicleMarkerData[];
  trafficLights: TrafficLightMarkerData[];
  congestionSegments: CongestionSegmentData[];
  emergencyRoute: EmergencyRouteData;
  metrics: PerformanceMetrics;
  benchmark: BenchmarkComparison | null;
  routingResult: RoutingResult | null;
  incidents: Incident[];
  rerouteCount: number;
  autoRerouteEnabled: boolean;
  emergencyPriorityEnabled: boolean;
  routeQualityScore: number;
  emergencyActive: boolean;
}
