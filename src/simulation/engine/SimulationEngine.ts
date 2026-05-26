import type { SimulationStatus, SimulationConfig, SimulationScenario } from '../../types/simulation';
import type { BenchmarkMode, FullBenchmarkResult } from '../../types/benchmark';
import { BenchmarkRunner } from '../benchmark/BenchmarkRunner';
import type {
  VehicleMarkerData,
  TrafficLightMarkerData,
  CongestionSegmentData,
  EmergencyRouteData,
} from '../../types/map';
import type { PerformanceMetrics, BenchmarkComparison } from '../../types/metrics';
import type {
  RoutingResult,
  DispatchState,
  DispatcherComparison,
  CompareDispatchState,
  NormalDispatchComparison,
} from '../../types/emergency';
import type { SyncMetrics } from '../../types/simulation';
import type { SimulationSnapshot } from '../../types/snapshot';
import type { TrafficLightPhase } from '../../types/traffic';
import type { RoadEdge } from '../pathfinding/roadGraph';
import type { VehicleGraphState } from '../vehicles/VehicleGraphState';
import { SequentialExecutor } from './SequentialExecutor';
import type { GraphContext } from './SequentialExecutor';
import { ParallelExecutor } from './ParallelExecutor';
import { generateFleet } from '../utils/fleetGenerator';
import { loadRoadGraph } from '../pathfinding/loadRoadGraph';
import type { LoadedGraph } from '../pathfinding/loadRoadGraph';
import { EmergencyRouter } from '../emergency/EmergencyRouter';
import { HeavyDispatchWorkerPool } from '../workers/HeavyDispatchWorkerPool';
import type { AdvantageWorkload } from '../../types/emergency';
import { ADVANTAGE_CANDIDATE_COUNTS } from '../../types/emergency';
import { IncidentManager } from '../incident/IncidentManager';
import { haversineM } from '../utils/geo';
import { edgeTravelCostS } from '../pathfinding/roadGraph';
import { interpolateEdge } from '../vehicles/VehicleMovement';
import { IntersectionSemaphoreManager } from '../synchronization/IntersectionSemaphoreManager';
import { EmergencyRequestQueue } from '../synchronization/EmergencyRequestQueue';
import { MOCK_TRAFFIC_LIGHTS, MOCK_CONGESTION_SEGMENTS } from '../../../data/scenarios/tiranaMockData';

const DEFAULT_CONFIG: SimulationConfig = {
  mode: 'parallel',
  speed: 1,
  vehicleCount: 50,
  scenario: 'morning-rush',
  compareMode: false,
  parallelAdvantageActive: false,
};

const ZERO_METRICS: PerformanceMetrics = {
  activeVehicles: 0,
  congestionLevel: 0,
  avgEmergencyResponseMs: 0,
  workerThreadCount: 0,
  tickRateHz: 0,
  cpuUsagePercent: 0,
};

// Phase offsets for dynamic congestion on the first 8 loaded edges
const DYNAMIC_PHASES = [0.00, 1.05, 2.10, 0.52, 1.73, 0.87, 0.30, 1.35];

const REROUTE_THRESHOLD = 1.25;
const REROUTE_COOLDOWN = 8;
// Simulated seconds the ambulance travels per simulation tick
const AMBULANCE_TICK_S = 10;
// How many edges ahead to scan for blockages
const LOOK_AHEAD_EDGES = 5;

// ─── Parallel Advantage Scenario scaling ─────────────────────────────────────
// Every COMPUTE_MS_PER_TICK ms of route-computation time = 1 tick of wait.
// With Heavy (1000 cands) sequential ≈ 2 000-8 000 ms and parallel ≈ 500-2 000 ms.
// 30 ms/tick keeps the delay perceptibly visible without being excessive.
//   Example: seq=3 000ms → 100 ticks   par=750ms → 25 ticks   → 75 tick advantage
const COMPUTE_MS_PER_TICK = 30;

// ─── Scenario profiles ────────────────────────────────────────────────────────
interface ScenarioProfile {
  congestionBase: number;
  congestionAmplitude: number;
  segmentDeltaAmplitude: number;
  metricsBase: number;
  metricsAmplitude: number;
  densityScale: number;
  autoEmergency: boolean;
}

const SCENARIO_PROFILES: Record<SimulationScenario, ScenarioProfile> = {
  'morning-rush': {
    congestionBase: 0.55, congestionAmplitude: 0.30,
    segmentDeltaAmplitude: 0.018,
    metricsBase: 0.55,    metricsAmplitude: 0.25,
    densityScale: 1.0,    autoEmergency: false,
  },
  'evening-rush': {
    congestionBase: 0.62, congestionAmplitude: 0.25,
    segmentDeltaAmplitude: 0.018,
    metricsBase: 0.62,    metricsAmplitude: 0.20,
    densityScale: 1.15,   autoEmergency: false,
  },
  'emergency-incident': {
    congestionBase: 0.45, congestionAmplitude: 0.20,
    segmentDeltaAmplitude: 0.012,
    metricsBase: 0.45,    metricsAmplitude: 0.15,
    densityScale: 0.80,   autoEmergency: true,
  },
  'night-low': {
    congestionBase: 0.10, congestionAmplitude: 0.08,
    segmentDeltaAmplitude: 0.005,
    metricsBase: 0.10,    metricsAmplitude: 0.07,
    densityScale: 0.20,   autoEmergency: false,
  },
};

export class SimulationEngine {
  // Independent fields
  private status: SimulationStatus = 'idle';
  private config: SimulationConfig = { ...DEFAULT_CONFIG };
  private tick = 0;
  private elapsedMs = 0;
  private startedAt: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private routing = false;
  private emergencyActive = false;
  private autoRerouteEnabled = true;
  private emergencyPriorityEnabled = true;
  private rerouteCount = 0;
  private lastRouteCostS = 0;
  private lastRerouteAt = -99;
  private routeQualityScore = 100;
  private congestionSegments: CongestionSegmentData[] = MOCK_CONGESTION_SEGMENTS.map((s) => ({ ...s }));
  private metrics: PerformanceMetrics = { ...ZERO_METRICS };
  private benchmark: BenchmarkComparison | null = null;
  private routingResult: RoutingResult | null = null;
  private onSnapshotCb?: (s: SimulationSnapshot) => void;
  private readonly sequential = new SequentialExecutor();
  private readonly parallel = new ParallelExecutor();
  private benchmarkRunning = false;
  private benchmarkProgress: number | null = null;
  private fullBenchmarkResult: FullBenchmarkResult | null = null;
  private benchmarkRunner!: BenchmarkRunner;
  private dispatchState: DispatchState | null = null;
  private readonly semaphoreManager: IntersectionSemaphoreManager;
  private readonly emergencyQueue: EmergencyRequestQueue;

  // ─── Normal mode dispatcher comparison ────────────────────────────────────
  private normalDispatchComparison: NormalDispatchComparison | null = null;

  // ─── Parallel Advantage Scenario ──────────────────────────────────────────
  private heavyPool: HeavyDispatchWorkerPool | null = null;
  private advantageWorkload: AdvantageWorkload = 'heavy';
  private advantageTotalEvaluations = 0;
  private advantageTickAdvantage = 0;

  // ─── Compare Dispatchers / Parallel Advantage mode ────────────────────────
  private compareActive = false;
  private seqRouting = false;
  private parRouting = false;
  private compareDispatch: {
    seq: (DispatchState & { finalComputeMs: number; dispatchDelayTicks: number; ticksWaited: number; routeProgressPct: number }) | null;
    par: (DispatchState & { finalComputeMs: number; dispatchDelayTicks: number; ticksWaited: number; routeProgressPct: number }) | null;
  } = { seq: null, par: null };
  private compareParRoute: EmergencyRouteData = { id: 'route-002', vehicleId: 'ev-002', waypoints: [] };

  // Graph-dependent fields — assigned in constructor
  private readonly graph: LoadedGraph;
  private readonly router: EmergencyRouter;
  private readonly incidentManager: IncidentManager;
  private readonly dynamicEdges: Array<{ id: string; phase: number }>;
  private readonly baseTrafficLights: TrafficLightMarkerData[];
  private trafficLights: TrafficLightMarkerData[];
  private vehicles: VehicleMarkerData[];
  private vehicleGraphStates: VehicleGraphState[];
  private emergencyRoute: EmergencyRouteData;

  constructor() {
    this.graph = loadRoadGraph();

    this.router = new EmergencyRouter(this.graph.nodes, this.graph.edges);
    this.incidentManager = new IncidentManager(
      this.graph.nodes,
      this.graph.edges,
      this.graph.startNodeId,
      this.graph.goalNodeId,
    );
    this.dynamicEdges = this.graph.edges
      .slice(0, Math.min(8, this.graph.edges.length))
      .map((e, i) => ({ id: e.id, phase: DYNAMIC_PHASES[i] }));

    this.baseTrafficLights = MOCK_TRAFFIC_LIGHTS.map((t) => ({ ...t }));
    this.trafficLights = MOCK_TRAFFIC_LIGHTS.map((t) => ({ ...t }));

    const fleet = generateFleet(DEFAULT_CONFIG.vehicleCount, this.graph);
    this.vehicles = fleet.vehicles;
    this.vehicleGraphStates = fleet.graphStates;

    const startNode = this.graph.nodesMap.get(this.graph.startNodeId);
    this.emergencyRoute = {
      id: 'route-001',
      vehicleId: 'ev-001',
      waypoints: startNode ? [startNode.position] : [],
    };

    this.benchmarkRunner = new BenchmarkRunner(this.graph);
    this.semaphoreManager = new IntersectionSemaphoreManager(
      this.graph.nodes.map((n) => n.id),
    );
    this.emergencyQueue = new EmergencyRequestQueue();
  }

  setOnSnapshot(cb: (s: SimulationSnapshot) => void): void {
    this.onSnapshotCb = cb;
  }

  start(): void {
    if (this.status === 'running') return;
    this.status = 'running';
    if (!this.startedAt) this.startedAt = Date.now();
    if (this.scenarioProfile().autoEmergency && !this.emergencyActive) {
      this.emergencyQueue.enqueue(this.tick);
    }
    this.scheduleLoop();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.clearLoop();
    this.emit();
  }

  reset(): void {
    this.clearLoop();
    this.ticking = false;
    this.status = 'idle';
    this.tick = 0;
    this.elapsedMs = 0;
    this.startedAt = null;
    this.trafficLights = this.baseTrafficLights.map((t) => ({ ...t }));
    this.congestionSegments = this.seedCongestionSegments();
    this.metrics = { ...ZERO_METRICS };
    this.benchmark = null;
    this.routingResult = null;
    this.emergencyActive = false;
    this.dispatchState = null;
    this.rerouteCount = 0;
    this.lastRouteCostS = 0;
    this.lastRerouteAt = -99;
    this.routeQualityScore = 100;
    this.normalDispatchComparison = null;
    // Parallel Advantage pool
    this.heavyPool?.terminate();
    this.heavyPool = null;
    this.advantageWorkload = 'heavy';
    this.advantageTotalEvaluations = 0;
    this.advantageTickAdvantage = 0;
    // Compare / Parallel Advantage state
    this.compareActive = false;
    this.seqRouting = false;
    this.parRouting = false;
    this.compareDispatch = { seq: null, par: null };
    this.compareParRoute = { id: 'route-002', vehicleId: 'ev-002', waypoints: [] };
    this.config = { ...this.config, compareMode: false, parallelAdvantageActive: false };
    this.incidentManager.reset();
    this.semaphoreManager.reset();
    this.emergencyQueue.reset();
    this.router.applyIncidentOverrides([]);

    const fleet = generateFleet(this.config.vehicleCount, this.graph);
    this.vehicles = fleet.vehicles;
    this.vehicleGraphStates = fleet.graphStates;

    const startNode = this.graph.nodesMap.get(this.graph.startNodeId);
    this.emergencyRoute = {
      id: 'route-001',
      vehicleId: 'ev-001',
      waypoints: startNode ? [startNode.position] : [],
    };

    this.emit();
  }

  updateConfig(patch: Partial<SimulationConfig>): void {
    const wasRunning = this.status === 'running';
    if (wasRunning) this.clearLoop();

    const prevCount    = this.config.vehicleCount;
    const prevScenario = this.config.scenario;
    this.config = { ...this.config, ...patch };

    if (patch.vehicleCount !== undefined && patch.vehicleCount !== prevCount) {
      const fleet = generateFleet(this.config.vehicleCount, this.graph);
      this.vehicles = fleet.vehicles;
      this.vehicleGraphStates = fleet.graphStates;
    }

    if (patch.scenario !== undefined && patch.scenario !== prevScenario) {
      this.congestionSegments = this.seedCongestionSegments();
      if (this.scenarioProfile().autoEmergency && !this.emergencyActive && wasRunning) {
        this.emergencyQueue.enqueue(this.tick);
        this.consumeEmergencyRequest();
      }
    }

    if (wasRunning) this.scheduleLoop();
    this.emit();
  }

  triggerEmergency(): void {
    // Normal mode: single ambulance, always compute both routes for comparison panel
    if (this.emergencyActive) return;
    this.emergencyQueue.enqueue(this.tick);
    if (this.status !== 'running') this.consumeEmergencyRequest();
    this.emit();
  }

  // ─── Parallel Advantage Scenario ─────────────────────────────────────────

  /** Launch the Parallel Advantage Scenario.
   *
   * @param workload  'standard' (500 candidates), 'heavy' (1000, default),
   *                  or 'extreme' (2000). Controls total A* evaluation count.
   *
   * Both ambulances wait at the start position while their dispatcher computes
   * the route.  Tick delay = ceil(computeMs / COMPUTE_MS_PER_TICK).
   * PAR finishes sooner → starts moving sooner → builds a head start.
   * Both drive at exactly the same speed after departure.
   */
  async runParallelAdvantageScenario(workload: AdvantageWorkload = 'heavy'): Promise<void> {
    if (this.compareActive) return;

    this.advantageWorkload = workload;
    const candidateCount = ADVANTAGE_CANDIDATE_COUNTS[workload];
    const totalEvaluations = candidateCount * 4; // 4 strategies

    // Ensure simulation is running so ambulances actually move
    if (this.status !== 'running') this.start();

    // Tear down any existing emergency state
    this.emergencyActive = false;
    this.dispatchState = null;
    this.routingResult = null;
    this.normalDispatchComparison = null;
    this.rerouteCount = 0;
    this.lastRerouteAt = -99;
    this.incidentManager.reset();
    this.router.applyIncidentOverrides([]);

    // Enable compare + advantage mode
    this.compareActive = true;
    this.config = { ...this.config, compareMode: true, parallelAdvantageActive: true };
    this.compareDispatch = { seq: null, par: null };

    // Inject PAR ambulance
    this.injectParAmbulance();
    this.emit();

    // ── Initialise persistent worker pool ─────────────────────────────────
    // Pool is created once per scenario run; workers cache the graph and
    // can be reused for any rerouting calls during the same scenario.
    this.heavyPool?.terminate();
    this.heavyPool = new HeavyDispatchWorkerPool();
    const { nodes: slimNodes, edges: slimEdges } = this.router.getSlimGraph();
    await this.heavyPool.initialize(slimNodes, slimEdges);

    console.log(
      `[Advantage] workload=${workload} candidates=${candidateCount} ` +
      `strategies=4 totalEvaluations=${totalEvaluations}`,
    );
    console.log(`[Advantage] sameTaskSeed=true sameStartGoal=true`);

    // ── Sequential heavy routing (main thread) ────────────────────────────
    const { computeMs: seqMs, result: seqResult } = await this.router.findRouteHeavy(
      this.graph.startNodeId,
      this.graph.goalNodeId,
      'sequential',
      candidateCount,
      // No pool for sequential — it runs in the main thread
    );

    // ── Parallel heavy routing (persistent worker pool) ───────────────────
    const { computeMs: parMs, result: parResult } = await this.router.findRouteHeavy(
      this.graph.startNodeId,
      this.graph.goalNodeId,
      'parallel',
      candidateCount,
      this.heavyPool,
    );

    // ── Verification logs ─────────────────────────────────────────────────
    console.log(
      `[Advantage] seqEvaluations=${totalEvaluations} parEvaluations=${totalEvaluations} sameWorkload=true`,
    );

    // ── Translate compute times to dispatch delay ticks ───────────────────
    const seqDelayTicks = Math.max(1, Math.ceil(seqMs / COMPUTE_MS_PER_TICK));
    const parDelayTicks = Math.max(0, Math.ceil(parMs / COMPUTE_MS_PER_TICK));
    const tickAdvantage = seqDelayTicks - parDelayTicks;
    const speedup = (seqMs / Math.max(0.001, parMs)).toFixed(2);

    this.advantageTotalEvaluations = totalEvaluations;
    this.advantageTickAdvantage = tickAdvantage;

    console.log(
      `[Advantage] RESULT sequential=${seqMs.toFixed(1)}ms(${seqDelayTicks}t) ` +
      `parallel=${parMs.toFixed(1)}ms(${parDelayTicks}t) ` +
      `speedup=${speedup}x tickAdvantage=${tickAdvantage}`,
    );

    const baseDs = (finalComputeMs: number, workersUsed: number, strategy: string, delayTicks: number) => ({
      status: 'routing' as const,
      routeEdgeIds: [] as string[],
      currentEdgeIndex: 0,
      progressOnEdge: 0,
      etaRemainingS: 0,
      distanceRemainingM: 0,
      startedAtTick: this.tick,
      completedAt: null,
      totalResponseTimeS: null,
      reroutes: 0,
      routeBlockedDetected: false,
      computeMs: finalComputeMs,
      workersUsed,
      selectedStrategy: strategy,
      finalComputeMs,
      dispatchDelayTicks: delayTicks,
      ticksWaited: 0,
      routeProgressPct: 0,
    });

    const startNode = this.graph.nodesMap.get(this.graph.startNodeId);

    if (seqResult.found) {
      const edgeIds = this.buildRouteEdgeIds(seqResult.nodeIds);
      this.compareDispatch.seq = {
        ...baseDs(seqMs, 0, seqResult.strategy, seqDelayTicks),
        status: 'active',
        routeEdgeIds: edgeIds,
      };
      this.emergencyRoute = { ...this.emergencyRoute, waypoints: seqResult.waypoints, color: '#3b82f6' };
    } else if (startNode) {
      this.compareDispatch.seq = { ...baseDs(seqMs, 0, 'standard', seqDelayTicks), status: 'routing' };
      this.emergencyRoute = { id: 'route-001', vehicleId: 'ev-001', waypoints: [startNode.position], color: '#3b82f6' };
    }

    if (parResult.found) {
      const edgeIds = this.buildRouteEdgeIds(parResult.nodeIds);
      this.compareDispatch.par = {
        ...baseDs(parMs, 4, parResult.strategy, parDelayTicks),
        status: 'active',
        routeEdgeIds: edgeIds,
      };
      this.compareParRoute = { id: 'route-002', vehicleId: 'ev-002', waypoints: parResult.waypoints, color: '#06b6d4' };
    } else if (startNode) {
      this.compareDispatch.par = { ...baseDs(parMs, 4, 'standard', parDelayTicks), status: 'routing' };
      this.compareParRoute = { id: 'route-002', vehicleId: 'ev-002', waypoints: [startNode.position], color: '#06b6d4' };
    }

    this.emit();
  }

  /** @deprecated Use triggerEmergency() — normal mode always shows comparison.
   *  Kept only for legacy WS message compatibility. */
  toggleCompareMode(): void {
    // No-op: compare mode is now only enabled through runParallelAdvantageScenario
  }

  private consumeEmergencyRequest(): void {
    if (this.emergencyActive) return;
    const req = this.emergencyQueue.consume();
    if (!req) return;
    this.emergencyActive = true;
    this.dispatchState = {
      status: 'routing',
      routeEdgeIds: [],
      currentEdgeIndex: 0,
      progressOnEdge: 0,
      etaRemainingS: 0,
      distanceRemainingM: 0,
      startedAtTick: this.tick,
      completedAt: null,
      totalResponseTimeS: null,
      reroutes: 0,
      routeBlockedDetected: false,
      computeMs: 0,
      workersUsed: 0,
      selectedStrategy: 'standard',
    };
    if (!this.routing) void this.runEmergencyRoutingBoth();
  }

  async runBenchmark(candidateCount: number, iterationCount: number, mode: BenchmarkMode): Promise<void> {
    if (this.benchmarkRunning) return;

    const wasRunning = this.status === 'running';
    if (wasRunning) this.clearLoop();

    this.benchmarkRunning = true;
    this.benchmarkProgress = 0;
    this.fullBenchmarkResult = null;
    this.emit();

    try {
      const result = await this.benchmarkRunner.run(candidateCount, iterationCount, mode, (pct) => {
        this.benchmarkProgress = pct;
        this.emit();
      });
      this.fullBenchmarkResult = result;
    } finally {
      this.benchmarkRunning = false;
      this.benchmarkProgress = null;
      this.emit();
    }

    if (wasRunning) this.scheduleLoop();
  }

  createManualIncident(): void {
    let routeEdgeIds = this.dispatchState?.routeEdgeIds ?? [];
    if (this.compareActive) {
      const seqIds = this.compareDispatch.seq?.routeEdgeIds ?? [];
      const parIds = this.compareDispatch.par?.routeEdgeIds ?? [];
      routeEdgeIds = [...new Set([...seqIds, ...parIds])];
    }
    this.incidentManager.createManual(this.tick, routeEdgeIds);
    this.router.applyIncidentOverrides(this.incidentManager.getEdgeOverrides());

    // In normal mode, measure reroute compare times for the comparison panel
    if (!this.compareActive && this.emergencyActive && this.dispatchState) {
      const fromEdge = this.graph.edgesMap.get(this.dispatchState.routeEdgeIds[this.dispatchState.currentEdgeIndex]);
      const fromNodeId = fromEdge?.from ?? this.graph.startNodeId;
      void this.measureAndStoreRerouteTimes(fromNodeId);
    }

    this.emit();
  }

  toggleAutoReroute(): void {
    this.autoRerouteEnabled = !this.autoRerouteEnabled;
    this.emit();
  }

  toggleEmergencyPriority(): void {
    this.emergencyPriorityEnabled = !this.emergencyPriorityEnabled;
    this.applyTrafficLightPriority();
    this.emit();
  }

  getSnapshot(): SimulationSnapshot {
    return {
      tick: this.tick,
      elapsedMs: this.elapsedMs,
      status: this.status,
      config: { ...this.config },
      vehicles: [...this.vehicles],
      trafficLights: [...this.trafficLights],
      congestionSegments: this.congestionSegments.map((s) => ({ ...s })),
      emergencyRoute: { ...this.emergencyRoute },
      metrics: { ...this.metrics },
      benchmark: this.benchmark,
      routingResult: this.routingResult,
      incidents: this.incidentManager.getActive().map((i) => ({ ...i })),
      rerouteCount: this.rerouteCount,
      autoRerouteEnabled: this.autoRerouteEnabled,
      emergencyPriorityEnabled: this.emergencyPriorityEnabled,
      routeQualityScore: this.routeQualityScore,
      emergencyActive: this.emergencyActive,
      benchmarkRunning: this.benchmarkRunning,
      benchmarkProgress: this.benchmarkProgress,
      fullBenchmarkResult: this.fullBenchmarkResult,
      dispatchState: this.dispatchState ? { ...this.dispatchState } : null,
      syncMetrics: this.buildSyncMetrics(),
      // Normal mode dispatcher comparison
      normalDispatchComparison: this.normalDispatchComparison,
      parallelAdvantageActive: this.config.parallelAdvantageActive,
      advantageWorkload: this.config.parallelAdvantageActive ? this.advantageWorkload : null,
      // Compare / Parallel Advantage Scenario
      dispatcherComparison: this.compareActive ? this.buildDispatcherComparison() : null,
      compareEmergencyRoute: this.compareActive ? { ...this.compareParRoute } : null,
    };
  }

  shutdown(): void {
    this.clearLoop();
    this.parallel.terminate();
    this.heavyPool?.terminate();
    this.heavyPool = null;
  }

  private scheduleLoop(): void {
    const intervalMs = Math.max(50, Math.round(1000 / this.config.speed));
    this.intervalId = setInterval(() => void this.tick_(), intervalMs);
  }

  private clearLoop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private buildGraphContext(): GraphContext {
    const liveEdges = this.router.getEdgesWithIncidents();
    return {
      edgesMap: new Map(liveEdges.map((e) => [e.id, e])),
      adjacency: this.graph.adjacency,
    };
  }

  private async tick_(): Promise<void> {
    if (this.status !== 'running' || this.ticking) return;
    this.ticking = true;

    try {
      const wallStart = performance.now();
      const ctx = this.buildGraphContext();
      const liveEdges = Array.from(ctx.edgesMap.values());

      const prevVehicles    = this.vehicles;
      const prevGraphStates = this.vehicleGraphStates;

      let seqMs: number;
      let parMs: number;

      if (this.config.mode === 'parallel') {
        const r = await this.parallel.execute(
          this.vehicles,
          this.vehicleGraphStates,
          liveEdges,
          this.graph.adjacency,
        );
        parMs = r.durationMs;
        seqMs = this.sequential.execute(r.vehicles, r.graphStates, ctx).durationMs * 2;
        const corrected = this.semaphoreManager.applyConstraints(
          prevGraphStates, r.graphStates, prevVehicles, r.vehicles, ctx.edgesMap,
        );
        this.vehicles = corrected.vehicles;
        this.vehicleGraphStates = corrected.graphStates;
      } else {
        const r = this.sequential.execute(this.vehicles, this.vehicleGraphStates, ctx);
        seqMs = r.durationMs;
        parMs = seqMs / 2;
        const corrected = this.semaphoreManager.applyConstraints(
          prevGraphStates, r.graphStates, prevVehicles, r.vehicles, ctx.edgesMap,
        );
        this.vehicles = corrected.vehicles;
        this.vehicleGraphStates = corrected.graphStates;
      }

      this.tick += 1;
      this.consumeEmergencyRequest();
      this.elapsedMs = this.startedAt ? Date.now() - this.startedAt : 0;

      this.evolveCongestion();
      this.incidentManager.tick(this.tick);
      this.router.applyIncidentOverrides(this.incidentManager.getEdgeOverrides());

      if (this.compareActive) {
        // ── Parallel Advantage / Compare mode: advance each ambulance ──────
        if (this.compareDispatch.seq) {
          this.advanceSingleAmbulance(ctx, this.compareDispatch.seq, 'ev-001', 'sequential');
        }
        if (this.compareDispatch.par) {
          this.advanceSingleAmbulance(ctx, this.compareDispatch.par, 'ev-002', 'parallel');
        }
      } else {
        // ── Normal single-dispatch path ────────────────────────────────────
        if (this.dispatchState?.status === 'active') {
          this.advanceAmbulance(ctx);
        }
        if (this.emergencyActive && this.autoRerouteEnabled) {
          this.checkAndReroute();
        }
      }

      this.routeQualityScore = this.computeRouteQualityScore();
      this.applyTrafficLightPriority();

      const wallMs = performance.now() - wallStart;

      const { metricsBase, metricsAmplitude } = this.scenarioProfile();
      this.metrics = {
        activeVehicles: this.vehicles.length,
        congestionLevel: Math.max(0, Math.min(1, metricsBase + Math.sin(this.tick * 0.04) * metricsAmplitude)),
        avgEmergencyResponseMs: this.routingResult?.estimatedTravelTimeS
          ? this.routingResult.estimatedTravelTimeS * 1000
          : 0,
        workerThreadCount: this.config.mode === 'parallel' ? 4 : 0,
        tickRateHz: Math.round(1000 / Math.max(1, wallMs)),
        cpuUsagePercent: 0,
      };

      this.benchmark = {
        sequentialTickMs: parseFloat(seqMs.toFixed(3)),
        parallelTickMs: parseFloat(parMs.toFixed(3)),
        speedupFactor: parseFloat((seqMs / Math.max(0.001, parMs)).toFixed(2)),
        throughputVehiclesPerSecond: Math.round(
          (this.vehicles.length * 1000) / Math.max(1, wallMs),
        ),
      };

      this.emit();
    } finally {
      this.ticking = false;
    }
  }

  private evolveCongestion(): void {
    const t = this.tick;
    const { congestionBase, congestionAmplitude, segmentDeltaAmplitude } = this.scenarioProfile();

    this.router.updateCongestion(
      this.dynamicEdges.map(({ id, phase }) => ({
        edgeId: id,
        congestion: Math.max(0, Math.min(1, congestionBase + Math.sin(t * 0.035 + phase) * congestionAmplitude)),
      })),
    );

    this.congestionSegments = this.congestionSegments.map((seg, i) => ({
      ...seg,
      density: Math.max(0.05, Math.min(0.95, seg.density + Math.sin(t * 0.04 + i * 1.2) * segmentDeltaAmplitude)),
    }));
  }

  private checkAndReroute(): void {
    if (this.routing) return;
    if (this.tick - this.lastRerouteAt < REROUTE_COOLDOWN) return;
    if (this.dispatchState?.status === 'active' || this.dispatchState?.status === 'rerouting') return;

    const currentCost = this.computeCurrentRouteCost();
    const routeBlocked = !isFinite(currentCost);
    const routeDegraded =
      isFinite(currentCost) &&
      this.lastRouteCostS > 0 &&
      currentCost > this.lastRouteCostS * REROUTE_THRESHOLD;

    if (routeBlocked || routeDegraded) {
      this.rerouteCount++;
      if (this.normalDispatchComparison) {
        this.normalDispatchComparison = { ...this.normalDispatchComparison, rerouteCount: this.rerouteCount };
      }
      this.lastRerouteAt = this.tick;
      void this.runEmergencyRoutingBoth();
    }
  }

  private computeCurrentRouteCost(): number {
    const nodeIds = this.routingResult?.nodeIds;
    if (!nodeIds || nodeIds.length < 2) return 0;

    const edges = this.router.getEdgesWithIncidents();
    const lookup = new Map<string, RoadEdge>();
    for (const edge of edges) {
      lookup.set(`${edge.from}\x00${edge.to}`, edge);
    }

    let total = 0;
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const edge = lookup.get(`${nodeIds[i]}\x00${nodeIds[i + 1]}`);
      if (!edge) return Infinity;
      const cost = edgeTravelCostS(edge);
      if (!isFinite(cost)) return Infinity;
      total += cost;
    }
    return total;
  }

  private computeRouteQualityScore(): number {
    if (!this.emergencyActive || !this.routingResult?.found) return 100;
    if (this.lastRouteCostS <= 0) return 100;
    const current = this.computeCurrentRouteCost();
    if (!isFinite(current)) return 0;
    return Math.round(Math.min(100, Math.max(0, (this.lastRouteCostS / current) * 100)));
  }

  private applyTrafficLightPriority(): void {
    const waypoints = this.emergencyRoute.waypoints;
    const prioritize =
      this.emergencyActive && this.emergencyPriorityEnabled && waypoints.length > 0;

    this.trafficLights = this.baseTrafficLights.map((light) => {
      const onRoute =
        prioritize && waypoints.some((wp) => haversineM(wp, light.position) < 200);
      return onRoute ? { ...light, phase: 'green' as TrafficLightPhase } : { ...light };
    });
  }

  // ─── Normal mode: always compute both routes for comparison panel ─────────

  /** Compute both sequential and parallel routes for normal single-ambulance mode.
   *  The ambulance follows the parallel route (best of 4 strategies).
   *  Both compute times are stored in normalDispatchComparison for the UI panel. */
  private async runEmergencyRoutingBoth(): Promise<void> {
    this.routing = true;
    try {
      // 1. Sequential route (main thread A*)
      const { result: seqResult, computeMs: seqMs } = await this.router.findRouteSequential(
        this.graph.startNodeId,
        this.graph.goalNodeId,
      );

      // 2. Parallel route (4 worker threads)
      const { result: parResult, computeMs: parMs } = await this.router.findRouteParallel(
        this.graph.startNodeId,
        this.graph.goalNodeId,
      );

      // Build comparison data
      const speedup = seqMs / Math.max(0.001, parMs);
      const winner: NormalDispatchComparison['winner'] =
        speedup > 1.05 ? 'parallel' : speedup < 0.95 ? 'sequential' : 'tie';

      this.normalDispatchComparison = {
        seqComputeMs: parseFloat(seqMs.toFixed(2)),
        parComputeMs: parseFloat(parMs.toFixed(2)),
        seqRouteCostS: seqResult.totalCostS,
        parRouteCostS: parResult.totalCostS,
        speedupFactor: parseFloat(speedup.toFixed(2)),
        winner,
        seqRerouteMs: null,
        parRerouteMs: null,
        rerouteCount: this.rerouteCount,
      };

      // Ambulance follows the parallel route (evaluates 4 strategies → often better)
      const best = parResult.found ? parResult : seqResult;
      this.routingResult = best;
      this.lastRouteCostS = best.totalCostS;

      if (best.found) {
        this.emergencyRoute = { ...this.emergencyRoute, waypoints: best.waypoints };
        if (this.dispatchState?.status === 'routing') {
          const edgeIds = this.buildRouteEdgeIds(best.nodeIds);
          this.dispatchState = {
            ...this.dispatchState,
            status: 'active',
            routeEdgeIds: edgeIds,
            currentEdgeIndex: 0,
            progressOnEdge: 0,
            computeMs: parMs,
            workersUsed: 4,
            selectedStrategy: best.strategy,
          };
        }
      }
      this.emit();
    } finally {
      this.routing = false;
    }
  }

  /** Measure how long seq and par rerouting would each take from current position
   *  and store the results in normalDispatchComparison for the UI panel. */
  private async measureAndStoreRerouteTimes(fromNodeId: string): Promise<void> {
    const { seqMs, parMs } = await this.router.measureRerouteComputeTimes(
      fromNodeId,
      this.graph.goalNodeId,
    );
    if (this.normalDispatchComparison) {
      this.normalDispatchComparison = {
        ...this.normalDispatchComparison,
        seqRerouteMs: parseFloat(seqMs.toFixed(2)),
        parRerouteMs: parseFloat(parMs.toFixed(2)),
        rerouteCount: this.rerouteCount + 1,
      };
      this.emit();
    }
  }

  private buildRouteEdgeIds(nodeIds: string[]): string[] {
    const edgeIds: string[] = [];
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const from = nodeIds[i];
      const to = nodeIds[i + 1];
      const candidates = this.graph.adjacency[from] ?? [];
      for (const eid of candidates) {
        const edge = this.graph.edgesMap.get(eid);
        if (edge?.to === to) {
          edgeIds.push(eid);
          break;
        }
      }
    }
    return edgeIds;
  }

  private advanceAmbulance(ctx: GraphContext): void {
    const ds = this.dispatchState;
    if (!ds || ds.status !== 'active' || ds.routeEdgeIds.length === 0) return;

    const edgeId = ds.routeEdgeIds[ds.currentEdgeIndex];
    if (!edgeId) return;

    const liveEdge = ctx.edgesMap.get(edgeId);
    if (!liveEdge) return;

    const costS = edgeTravelCostS(liveEdge);
    const delta = isFinite(costS) && costS > 0 ? AMBULANCE_TICK_S / costS : 1;
    ds.progressOnEdge += delta;

    while (ds.progressOnEdge >= 1.0 && ds.currentEdgeIndex < ds.routeEdgeIds.length - 1) {
      ds.progressOnEdge -= 1.0;
      ds.currentEdgeIndex++;
    }

    if (ds.progressOnEdge >= 1.0) {
      this.onAmbulanceArrived(ds);
      return;
    }

    const geomEdge = this.graph.edgesMap.get(ds.routeEdgeIds[ds.currentEdgeIndex]) ?? liveEdge;
    if (geomEdge.coordinates && geomEdge.coordinates.length >= 2) {
      const position = interpolateEdge(geomEdge, ds.progressOnEdge);
      this.vehicles = this.vehicles.map((v) => (v.isEmergency ? { ...v, position } : v));
    }

    if (!this.routing) {
      this.checkRouteBlockage(ctx, ds);
    }

    this.updateDispatchMetrics(ctx, ds);
  }

  private checkRouteBlockage(ctx: GraphContext, ds: DispatchState): void {
    const end = Math.min(ds.currentEdgeIndex + LOOK_AHEAD_EDGES, ds.routeEdgeIds.length);
    for (let i = ds.currentEdgeIndex; i < end; i++) {
      const edge = ctx.edgesMap.get(ds.routeEdgeIds[i]);
      if (edge?.blocked) {
        ds.routeBlockedDetected = true;
        ds.status = 'rerouting';
        ds.reroutes++;
        this.rerouteCount++;
        this.lastRerouteAt = this.tick;
        const currentEdge = this.graph.edgesMap.get(ds.routeEdgeIds[ds.currentEdgeIndex]);
        const fromNodeId = currentEdge?.from ?? this.graph.startNodeId;
        void this.rerouteAmbulanceFrom(fromNodeId, ds);
        return;
      }
    }
  }

  private async rerouteAmbulanceFrom(fromNodeId: string, ds: DispatchState): Promise<void> {
    this.routing = true;
    try {
      // Parallel reroute for single ambulance
      const { result, computeMs: parMs } = await this.router.findRouteParallel(fromNodeId, this.graph.goalNodeId);
      const { computeMs: seqMs } = await this.router.findRouteSequential(fromNodeId, this.graph.goalNodeId);

      this.routingResult = result;
      this.lastRouteCostS = result.totalCostS;
      if (result.found) {
        const edgeIds = this.buildRouteEdgeIds(result.nodeIds);
        ds.routeEdgeIds = edgeIds;
        ds.currentEdgeIndex = 0;
        ds.progressOnEdge = 0;
        ds.computeMs = parMs;
        ds.selectedStrategy = result.strategy;
        ds.workersUsed = 4;
        this.emergencyRoute = { ...this.emergencyRoute, waypoints: result.waypoints };
      }

      // Update comparison with reroute times
      if (this.normalDispatchComparison) {
        this.normalDispatchComparison = {
          ...this.normalDispatchComparison,
          seqRerouteMs: parseFloat(seqMs.toFixed(2)),
          parRerouteMs: parseFloat(parMs.toFixed(2)),
          rerouteCount: this.rerouteCount,
        };
      }

      ds.status = 'active';
      this.emit();
    } finally {
      this.routing = false;
    }
  }

  private updateDispatchMetrics(ctx: GraphContext, ds: DispatchState, updateGlobalResult = true): void {
    let etaS = 0;
    let distM = 0;
    for (let i = ds.currentEdgeIndex; i < ds.routeEdgeIds.length; i++) {
      const edge = ctx.edgesMap.get(ds.routeEdgeIds[i]);
      if (!edge) continue;
      const fraction = i === ds.currentEdgeIndex ? (1 - ds.progressOnEdge) : 1;
      const costS = edgeTravelCostS(edge);
      if (isFinite(costS)) etaS += costS * fraction;
      distM += edge.distanceM * fraction;
    }
    ds.etaRemainingS = etaS;
    ds.distanceRemainingM = distM;
    if (updateGlobalResult && this.routingResult) {
      this.routingResult = { ...this.routingResult, estimatedTravelTimeS: etaS };
    }
  }

  private buildSyncMetrics(): SyncMetrics {
    const sem = this.semaphoreManager.getMetrics();
    const q   = this.emergencyQueue.getMetrics();
    return {
      semaphoreAcquisitions:  sem.acquisitions,
      semaphoreWaits:         sem.waits,
      blockedThisTick:        sem.blockedThisTick,
      controlledIntersections: sem.controlledIntersections,
      emergencyProduced:      q.produced,
      emergencyConsumed:      q.consumed,
      emergencyPending:       q.pending,
    };
  }

  private onAmbulanceArrived(ds: DispatchState): void {
    ds.status = 'completed';
    ds.etaRemainingS = 0;
    ds.distanceRemainingM = 0;
    ds.completedAt = Date.now();
    ds.totalResponseTimeS = (this.tick - ds.startedAtTick) * AMBULANCE_TICK_S;
    const goalNode = this.graph.nodesMap.get(this.graph.goalNodeId);
    if (goalNode) {
      this.vehicles = this.vehicles.map((v) => (v.isEmergency ? { ...v, position: goalNode.position } : v));
    }
    this.emergencyActive = false;
  }

  // ─── Compare / Parallel Advantage Scenario helpers ────────────────────────

  private injectParAmbulance(): void {
    const startNode = this.graph.nodesMap.get(this.graph.startNodeId);
    if (!startNode) return;
    // Tag ev-001 as SEQ dispatcher
    this.vehicles = this.vehicles
      .filter((v) => v.id !== 'ev-002')
      .map((v) => (v.id === 'ev-001' ? { ...v, label: 'SEQ' } : v));
    // Add PAR ambulance at the same origin
    this.vehicles.push({
      id: 'ev-002',
      type: 'emergency',
      isEmergency: true,
      position: startNode.position,
      label: 'PAR',
    });
    this.vehicleGraphStates = this.vehicleGraphStates.filter((gs) => gs.id !== 'ev-002');
    const seqState = this.vehicleGraphStates.find((gs) => gs.id === 'ev-001');
    this.vehicleGraphStates.push({ id: 'ev-002', edgeId: seqState?.edgeId ?? '', progress: 0 });
  }

  private advanceSingleAmbulance(
    ctx: GraphContext,
    ds: DispatchState & { finalComputeMs: number; dispatchDelayTicks: number; ticksWaited: number; routeProgressPct: number },
    vehicleId: 'ev-001' | 'ev-002',
    role: 'sequential' | 'parallel',
  ): void {
    if (ds.status !== 'active' || ds.routeEdgeIds.length === 0) return;

    // ── Computation delay: ambulance waits at start until dispatch delay expires ──
    if (ds.ticksWaited < ds.dispatchDelayTicks) {
      ds.ticksWaited++;
      return; // Still waiting — route was being computed
    }

    const edgeId = ds.routeEdgeIds[ds.currentEdgeIndex];
    if (!edgeId) return;

    const liveEdge = ctx.edgesMap.get(edgeId);
    if (!liveEdge) return;

    const costS = edgeTravelCostS(liveEdge);
    const delta = isFinite(costS) && costS > 0 ? AMBULANCE_TICK_S / costS : 1;
    ds.progressOnEdge += delta;

    while (ds.progressOnEdge >= 1.0 && ds.currentEdgeIndex < ds.routeEdgeIds.length - 1) {
      ds.progressOnEdge -= 1.0;
      ds.currentEdgeIndex++;
    }

    // Update route progress %
    ds.routeProgressPct = parseFloat(
      (ds.currentEdgeIndex / Math.max(1, ds.routeEdgeIds.length) * 100).toFixed(1),
    );

    if (ds.progressOnEdge >= 1.0) {
      this.onCompareAmbulanceArrived(ds, vehicleId);
      return;
    }

    const geomEdge = this.graph.edgesMap.get(ds.routeEdgeIds[ds.currentEdgeIndex]) ?? liveEdge;
    if (geomEdge.coordinates && geomEdge.coordinates.length >= 2) {
      const position = interpolateEdge(geomEdge, ds.progressOnEdge);
      this.vehicles = this.vehicles.map((v) => (v.id === vehicleId ? { ...v, position } : v));
    }

    const isCurrentlyRouting = role === 'sequential' ? this.seqRouting : this.parRouting;
    if (!isCurrentlyRouting) {
      this.checkCompareBlockage(ctx, ds, vehicleId, role);
    }

    this.updateDispatchMetrics(ctx, ds, false);
  }

  private checkCompareBlockage(
    ctx: GraphContext,
    ds: DispatchState & { finalComputeMs: number; dispatchDelayTicks: number; ticksWaited: number; routeProgressPct: number },
    vehicleId: 'ev-001' | 'ev-002',
    role: 'sequential' | 'parallel',
  ): void {
    const end = Math.min(ds.currentEdgeIndex + LOOK_AHEAD_EDGES, ds.routeEdgeIds.length);
    for (let i = ds.currentEdgeIndex; i < end; i++) {
      const edge = ctx.edgesMap.get(ds.routeEdgeIds[i]);
      if (edge?.blocked) {
        ds.routeBlockedDetected = true;
        ds.status = 'rerouting';
        ds.reroutes++;
        const currentEdge = this.graph.edgesMap.get(ds.routeEdgeIds[ds.currentEdgeIndex]);
        const fromNodeId = currentEdge?.from ?? this.graph.startNodeId;
        void this.rerouteCompareAmbulance(role === 'sequential' ? 'seq' : 'par', fromNodeId, ds, vehicleId);
        return;
      }
    }
  }

  private async rerouteCompareAmbulance(
    which: 'seq' | 'par',
    fromNodeId: string,
    ds: DispatchState & { finalComputeMs: number; dispatchDelayTicks: number; ticksWaited: number; routeProgressPct: number },
    vehicleId: 'ev-001' | 'ev-002',
  ): Promise<void> {
    if (which === 'seq') this.seqRouting = true; else this.parRouting = true;
    const candidateCount = ADVANTAGE_CANDIDATE_COUNTS[this.advantageWorkload];
    try {
      const rerouteStart = performance.now();
      const result = which === 'par'
        ? await this.router.findRouteHeavy(fromNodeId, this.graph.goalNodeId, 'parallel', candidateCount, this.heavyPool ?? undefined)
        : await this.router.findRouteHeavy(fromNodeId, this.graph.goalNodeId, 'sequential', candidateCount);
      const rerouteMs = performance.now() - rerouteStart;

      if (result.result.found) {
        ds.routeEdgeIds = this.buildRouteEdgeIds(result.result.nodeIds);
        ds.currentEdgeIndex = 0;
        ds.progressOnEdge = 0;
        ds.computeMs = result.result.routingComputationMs;
        ds.selectedStrategy = result.result.strategy;
        ds.workersUsed = which === 'par' ? 4 : 0;
        ds.finalComputeMs = rerouteMs;
        // Update reroute delay for this ambulance
        const newDelay = Math.max(0, Math.ceil(rerouteMs / COMPUTE_MS_PER_TICK));
        ds.dispatchDelayTicks = newDelay;
        ds.ticksWaited = 0; // reset wait counter for the reroute pause
        if (vehicleId === 'ev-001') {
          this.emergencyRoute = { ...this.emergencyRoute, waypoints: result.result.waypoints };
        } else {
          this.compareParRoute = { ...this.compareParRoute, waypoints: result.result.waypoints };
        }
      }
      ds.status = 'active';
      this.emit();
    } finally {
      if (which === 'seq') this.seqRouting = false; else this.parRouting = false;
    }
  }

  private onCompareAmbulanceArrived(
    ds: DispatchState & { finalComputeMs: number; dispatchDelayTicks: number; ticksWaited: number; routeProgressPct: number },
    vehicleId: 'ev-001' | 'ev-002',
  ): void {
    ds.status = 'completed';
    ds.routeProgressPct = 100;
    ds.etaRemainingS = 0;
    ds.distanceRemainingM = 0;
    ds.completedAt = Date.now();
    ds.totalResponseTimeS = (this.tick - ds.startedAtTick) * AMBULANCE_TICK_S;
    const goalNode = this.graph.nodesMap.get(this.graph.goalNodeId);
    if (goalNode) {
      this.vehicles = this.vehicles.map((v) =>
        v.id === vehicleId ? { ...v, position: goalNode.position } : v,
      );
    }
    const seqDone = !this.compareDispatch.seq || this.compareDispatch.seq.status === 'completed';
    const parDone = !this.compareDispatch.par || this.compareDispatch.par.status === 'completed';
    if (seqDone && parDone) {
      // Scenario complete — release the worker pool
      this.heavyPool?.terminate();
      this.heavyPool = null;
      this.compareActive = false;
      this.config = { ...this.config, compareMode: false, parallelAdvantageActive: false };
    }
  }

  private buildDispatcherComparison(): DispatcherComparison | null {
    const seq = this.compareDispatch.seq;
    const par = this.compareDispatch.par;
    if (!seq || !par) return null;

    let speedupFactor: number | null = null;
    let winner: 'sequential' | 'parallel' | null = null;

    if (seq.finalComputeMs > 0 && par.finalComputeMs > 0) {
      speedupFactor = parseFloat((seq.finalComputeMs / Math.max(0.001, par.finalComputeMs)).toFixed(2));
      if (speedupFactor > 1.05) winner = 'parallel';
      else if (speedupFactor < 0.95) winner = 'sequential';
    }

    const toCompareDs = (
      ds: DispatchState & { finalComputeMs: number; dispatchDelayTicks: number; ticksWaited: number; routeProgressPct: number },
      role: 'sequential' | 'parallel',
    ): CompareDispatchState => ({
      ...ds,
      role,
    });

    return {
      sequential: toCompareDs(seq, 'sequential'),
      parallel:   toCompareDs(par, 'parallel'),
      speedupFactor,
      winner,
      parallelAdvantageActive: this.config.parallelAdvantageActive,
      workload: this.advantageWorkload,
      totalEvaluations: this.advantageTotalEvaluations,
      tickAdvantage: this.advantageTickAdvantage,
    };
  }

  // ─── Scenario helpers ─────────────────────────────────────────────────────

  private scenarioProfile(): ScenarioProfile {
    return SCENARIO_PROFILES[this.config.scenario];
  }

  private seedCongestionSegments(): CongestionSegmentData[] {
    const { densityScale } = this.scenarioProfile();
    return MOCK_CONGESTION_SEGMENTS.map((s) => ({
      ...s,
      density: Math.max(0.05, Math.min(0.95, s.density * densityScale)),
    }));
  }

  private emit(): void {
    this.onSnapshotCb?.(this.getSnapshot());
  }
}
