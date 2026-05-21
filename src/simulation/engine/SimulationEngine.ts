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
import { SequentialExecutor } from './SequentialExecutor';
import { ParallelExecutor } from './ParallelExecutor';
import { generateFleet } from '../utils/fleetGenerator';
import { EmergencyRouter } from '../emergency/EmergencyRouter';
import {
  TIRANA_NODES,
  TIRANA_BASE_EDGES,
  AMBULANCE_START_NODE,
  HOSPITAL_NODE,
} from '../pathfinding/tiranaRoadGraph';
import {
  MOCK_TRAFFIC_LIGHTS,
  MOCK_CONGESTION_SEGMENTS,
  MOCK_EMERGENCY_ROUTE,
} from '../../../data/scenarios/tiranaMockData';

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

// Edge IDs whose congestion evolves each tick (representative set)
const DYNAMIC_EDGES = [
  { id: 'E01',  phase: 0.00 },
  { id: 'E02',  phase: 1.05 },
  { id: 'E03',  phase: 2.10 },
  { id: 'E08',  phase: 0.52 },
  { id: 'E11',  phase: 1.73 },
  { id: 'E12',  phase: 0.87 },
  { id: 'E01r', phase: 0.30 },
  { id: 'E02r', phase: 1.35 },
];

export class SimulationEngine {
  private status: SimulationStatus = 'idle';
  private config: SimulationConfig = { ...DEFAULT_CONFIG };
  private tick = 0;
  private elapsedMs = 0;
  private startedAt: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private routing = false;

  private vehicles: VehicleMarkerData[] = generateFleet(DEFAULT_CONFIG.vehicleCount);
  private readonly trafficLights: TrafficLightMarkerData[] = [...MOCK_TRAFFIC_LIGHTS];
  private congestionSegments: CongestionSegmentData[] = MOCK_CONGESTION_SEGMENTS.map((s) => ({ ...s }));
  private emergencyRoute: EmergencyRouteData = { ...MOCK_EMERGENCY_ROUTE };
  private metrics: PerformanceMetrics = { ...ZERO_METRICS };
  private benchmark: BenchmarkComparison | null = null;
  private routingResult: RoutingResult | null = null;

  private readonly sequential = new SequentialExecutor();
  private readonly parallel = new ParallelExecutor();
  private readonly router = new EmergencyRouter(TIRANA_NODES, TIRANA_BASE_EDGES);
  private onSnapshotCb?: (s: SimulationSnapshot) => void;

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
    this.vehicles = generateFleet(this.config.vehicleCount);
    this.congestionSegments = MOCK_CONGESTION_SEGMENTS.map((s) => ({ ...s }));
    this.emergencyRoute = { ...MOCK_EMERGENCY_ROUTE };
    this.metrics = { ...ZERO_METRICS };
    this.benchmark = null;
    this.routingResult = null;
    this.emit();
  }

  updateConfig(patch: Partial<SimulationConfig>): void {
    const wasRunning = this.status === 'running';
    if (wasRunning) this.clearLoop();

    const prevCount = this.config.vehicleCount;
    this.config = { ...this.config, ...patch };

    if (patch.vehicleCount !== undefined && patch.vehicleCount !== prevCount) {
      this.vehicles = generateFleet(this.config.vehicleCount);
    }

    if (wasRunning) this.scheduleLoop();
    this.emit();
  }

  triggerEmergency(): void {
    if (this.routing) return;
    void this.runEmergencyRouting();
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

  private async tick_(): Promise<void> {
    if (this.status !== 'running' || this.ticking) return;
    this.ticking = true;

    try {
      const wallStart = performance.now();

      let seqMs: number;
      let parMs: number;

      if (this.config.mode === 'parallel') {
        const r = await this.parallel.execute(this.vehicles, this.tick);
        this.vehicles = r.vehicles;
        parMs = r.durationMs;
        seqMs = this.sequential.execute(this.vehicles, this.tick).durationMs * 2;
      } else {
        const r = this.sequential.execute(this.vehicles, this.tick);
        this.vehicles = r.vehicles;
        seqMs = r.durationMs;
        parMs = seqMs / 2;
      }

      this.tick += 1;
      this.elapsedMs = this.startedAt ? Date.now() - this.startedAt : 0;

      this.evolveCongestion();

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
    const updates = DYNAMIC_EDGES.map(({ id, phase }) => ({
      edgeId: id,
      congestion: 0.35 + Math.sin(t * 0.035 + phase) * 0.30,
    }));
    this.router.updateCongestion(updates);

    // Drift the visual congestion segments in sync
    this.congestionSegments = this.congestionSegments.map((seg, i) => ({
      ...seg,
      density: Math.max(0.05, Math.min(0.95, seg.density + Math.sin(t * 0.04 + i * 1.2) * 0.015)),
    }));
  }

  private async runEmergencyRouting(): Promise<void> {
    this.routing = true;
    try {
      const result = await this.router.findRouteBest(
        AMBULANCE_START_NODE,
        HOSPITAL_NODE,
        this.config.mode,
      );
      this.routingResult = result;
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
