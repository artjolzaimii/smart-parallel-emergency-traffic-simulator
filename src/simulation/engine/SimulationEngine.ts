import type { SimulationStatus, SimulationConfig } from '../../types/simulation';
import type {
  VehicleMarkerData,
  TrafficLightMarkerData,
  CongestionSegmentData,
  EmergencyRouteData,
} from '../../types/map';
import type { PerformanceMetrics, BenchmarkComparison } from '../../types/metrics';
import type { RoutingResult } from '../../types/emergency';
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
import { IncidentManager } from '../incident/IncidentManager';
import { haversineM } from '../utils/geo';
import { edgeTravelCostS } from '../pathfinding/roadGraph';
import { MOCK_TRAFFIC_LIGHTS, MOCK_CONGESTION_SEGMENTS } from '../../../data/scenarios/tiranaMockData';

const DEFAULT_CONFIG: SimulationConfig = {
  mode: 'parallel',
  speed: 1,
  vehicleCount: 50,
  scenario: 'morning-rush',
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
  }

  setOnSnapshot(cb: (s: SimulationSnapshot) => void): void {
    this.onSnapshotCb = cb;
  }

  start(): void {
    if (this.status === 'running') return;
    this.status = 'running';
    if (!this.startedAt) this.startedAt = Date.now();
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
    this.congestionSegments = MOCK_CONGESTION_SEGMENTS.map((s) => ({ ...s }));
    this.metrics = { ...ZERO_METRICS };
    this.benchmark = null;
    this.routingResult = null;
    this.emergencyActive = false;
    this.rerouteCount = 0;
    this.lastRouteCostS = 0;
    this.lastRerouteAt = -99;
    this.routeQualityScore = 100;
    this.incidentManager.reset();
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

    const prevCount = this.config.vehicleCount;
    this.config = { ...this.config, ...patch };

    if (patch.vehicleCount !== undefined && patch.vehicleCount !== prevCount) {
      const fleet = generateFleet(this.config.vehicleCount, this.graph);
      this.vehicles = fleet.vehicles;
      this.vehicleGraphStates = fleet.graphStates;
    }

    if (wasRunning) this.scheduleLoop();
    this.emit();
  }

  triggerEmergency(): void {
    this.emergencyActive = true;
    if (this.routing) return;
    void this.runEmergencyRouting();
  }

  createManualIncident(): void {
    this.incidentManager.createManual(this.tick);
    this.router.applyIncidentOverrides(this.incidentManager.getEdgeOverrides());
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
    };
  }

  shutdown(): void {
    this.clearLoop();
    this.parallel.terminate();
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

      let seqMs: number;
      let parMs: number;

      if (this.config.mode === 'parallel') {
        const r = await this.parallel.execute(
          this.vehicles,
          this.vehicleGraphStates,
          liveEdges,
          this.graph.adjacency,
        );
        this.vehicles = r.vehicles;
        this.vehicleGraphStates = r.graphStates;
        parMs = r.durationMs;
        // Simulate sequential cost for benchmark comparison
        seqMs = this.sequential.execute(this.vehicles, this.vehicleGraphStates, ctx).durationMs * 2;
      } else {
        const r = this.sequential.execute(this.vehicles, this.vehicleGraphStates, ctx);
        this.vehicles = r.vehicles;
        this.vehicleGraphStates = r.graphStates;
        seqMs = r.durationMs;
        parMs = seqMs / 2;
      }

      this.tick += 1;
      this.elapsedMs = this.startedAt ? Date.now() - this.startedAt : 0;

      this.evolveCongestion();

      this.incidentManager.tick(this.tick);
      this.router.applyIncidentOverrides(this.incidentManager.getEdgeOverrides());

      if (this.emergencyActive && this.autoRerouteEnabled) {
        this.checkAndReroute();
      }

      this.routeQualityScore = this.computeRouteQualityScore();
      this.applyTrafficLightPriority();

      const wallMs = performance.now() - wallStart;

      this.metrics = {
        activeVehicles: this.vehicles.length,
        congestionLevel: 0.3 + Math.sin(this.tick * 0.04) * 0.25,
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
    this.router.updateCongestion(
      this.dynamicEdges.map(({ id, phase }) => ({
        edgeId: id,
        congestion: 0.35 + Math.sin(t * 0.035 + phase) * 0.30,
      })),
    );

    this.congestionSegments = this.congestionSegments.map((seg, i) => ({
      ...seg,
      density: Math.max(0.05, Math.min(0.95, seg.density + Math.sin(t * 0.04 + i * 1.2) * 0.015)),
    }));
  }

  private checkAndReroute(): void {
    if (this.routing) return;
    if (this.tick - this.lastRerouteAt < REROUTE_COOLDOWN) return;

    const currentCost = this.computeCurrentRouteCost();
    const routeBlocked = !isFinite(currentCost);
    const routeDegraded =
      isFinite(currentCost) &&
      this.lastRouteCostS > 0 &&
      currentCost > this.lastRouteCostS * REROUTE_THRESHOLD;

    if (routeBlocked || routeDegraded) {
      this.rerouteCount++;
      this.lastRerouteAt = this.tick;
      void this.runEmergencyRouting();
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

  private async runEmergencyRouting(): Promise<void> {
    this.routing = true;
    try {
      const result = await this.router.findRouteBest(
        this.graph.startNodeId,
        this.graph.goalNodeId,
        this.config.mode,
      );
      this.routingResult = result;
      this.lastRouteCostS = result.totalCostS;
      if (result.found) {
        this.emergencyRoute = { ...this.emergencyRoute, waypoints: result.waypoints };
      }
      this.emit();
    } finally {
      this.routing = false;
    }
  }

  private emit(): void {
    this.onSnapshotCb?.(this.getSnapshot());
  }
}
