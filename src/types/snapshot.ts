import type { SimulationStatus, SimulationConfig, SyncMetrics } from './simulation';
import type {
  VehicleMarkerData,
  TrafficLightMarkerData,
  CongestionSegmentData,
  EmergencyRouteData,
} from './map';
import type { PerformanceMetrics, BenchmarkComparison } from './metrics';
import type { RoutingResult, DispatchState, DispatcherComparison, NormalDispatchComparison, AdvantageWorkload } from './emergency';
import type { Incident } from './incident';
import type { FullBenchmarkResult } from './benchmark';
import type { SimulationEvent } from './events';

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
  // Dedicated benchmark run state
  benchmarkRunning: boolean;
  benchmarkProgress: number | null; // 0–100 while running
  fullBenchmarkResult: FullBenchmarkResult | null;
  // Live ambulance dispatch tracking
  dispatchState: DispatchState | null;
  // Synchronization subsystem metrics
  syncMetrics: SyncMetrics;
  // Compare Dispatchers / Parallel Advantage Scenario — null when not active
  dispatcherComparison: DispatcherComparison | null;
  compareEmergencyRoute: EmergencyRouteData | null;
  /** Always present after the first emergency is triggered in normal mode.
   *  Shows sequential vs parallel dispatch compute time comparison. */
  normalDispatchComparison: NormalDispatchComparison | null;
  /** True when Parallel Advantage Scenario is active. */
  parallelAdvantageActive: boolean;
  /** Which workload level was chosen for the current Parallel Advantage run. */
  advantageWorkload: AdvantageWorkload | null;
  /** Chronological event log (most recent first, max 20 entries). */
  eventLog: SimulationEvent[];
}
