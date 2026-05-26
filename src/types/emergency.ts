import type { GeoPosition, SimulationMode } from './simulation';

export type RouteStrategy = 'standard' | 'avoid-congestion' | 'avoid-blocked' | 'prefer-speed';

/** Workload size for the Parallel Advantage Scenario. */
export type AdvantageWorkload = 'standard' | 'heavy' | 'extreme';

/** Candidate counts per workload level.
 *  Total A* evaluations = candidateCount × 4 strategies. */
export const ADVANTAGE_CANDIDATE_COUNTS: Record<AdvantageWorkload, number> = {
  standard: 500,
  heavy:    1000,
  extreme:  2000,
};

// ─── Compare-dispatcher types ────────────────────────────────────────────────
export type DispatcherRole = 'sequential' | 'parallel';

/** A DispatchState annotated with which dispatcher it belongs to and its
 *  most-recently measured raw routing compute time (ms). */
export interface CompareDispatchState extends DispatchState {
  role: DispatcherRole;
  /** Wall-clock time for the last routing/rerouting call (ms). */
  finalComputeMs: number;
  /** Parallel Advantage Scenario: how many ticks this ambulance must wait
   *  at the start position while the route is being computed.
   *  Derived from computeMs / COMPUTE_MS_PER_TICK. */
  dispatchDelayTicks: number;
  /** Ticks the ambulance has already waited (counts up to dispatchDelayTicks). */
  ticksWaited: number;
  /** Route completion 0–100 %. Updated each tick. */
  routeProgressPct: number;
}

/** Side-by-side snapshot of both dispatchers sent in every tick snapshot
 *  when Compare Dispatchers mode is active. */
export interface DispatcherComparison {
  sequential: CompareDispatchState;
  parallel: CompareDispatchState;
  /** seq.finalComputeMs / par.finalComputeMs — null until both have routed. */
  speedupFactor: number | null;
  /** Which dispatcher computed the route faster, or null for a tie. */
  winner: DispatcherRole | null;
  /** True when the Parallel Advantage Scenario heavy-workload is active. */
  parallelAdvantageActive: boolean;
  /** Workload level used in the Parallel Advantage Scenario. */
  workload?: AdvantageWorkload;
  /** How many route candidates were evaluated (candidateCount × 4 strategies). */
  totalEvaluations?: number;
  /** Tick head-start for PAR: seqDelayTicks − parDelayTicks. Positive = PAR wins. */
  tickAdvantage?: number;
}

/** Comparison of sequential vs parallel dispatcher in normal single-ambulance mode.
 *  Computed every time "Trigger Emergency" is clicked and shown in the panel. */
export interface NormalDispatchComparison {
  /** Wall-clock time to compute the sequential route (ms). */
  seqComputeMs: number;
  /** Wall-clock time to compute the parallel route (ms). */
  parComputeMs: number;
  /** Total route cost for the sequential route (simulated seconds). */
  seqRouteCostS: number;
  /** Total route cost for the parallel route (simulated seconds). */
  parRouteCostS: number;
  /** seqComputeMs / parComputeMs. */
  speedupFactor: number;
  /** Which dispatcher finished computation faster. */
  winner: 'sequential' | 'parallel' | 'tie';
  /** Latest rerouting compute time for sequential dispatcher (ms), or null. */
  seqRerouteMs: number | null;
  /** Latest rerouting compute time for parallel dispatcher (ms), or null. */
  parRerouteMs: number | null;
  /** Reroute count for the normal single-ambulance mode. */
  rerouteCount: number;
}

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
