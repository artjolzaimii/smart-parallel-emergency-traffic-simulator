import type { SimulationStatus, SimulationConfig } from '../../types/simulation';
import type {
  VehicleMarkerData,
  TrafficLightMarkerData,
  CongestionSegmentData,
  EmergencyRouteData,
} from '../../types/map';
import type { PerformanceMetrics, BenchmarkComparison } from '../../types/metrics';
import type { SimulationSnapshot } from '../../types/snapshot';
import { SequentialExecutor } from './SequentialExecutor';
import { ParallelExecutor } from './ParallelExecutor';
import {
  MOCK_VEHICLES,
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

export class SimulationEngine {
  private status: SimulationStatus = 'idle';
  private config: SimulationConfig = { ...DEFAULT_CONFIG };
  private tick = 0;
  private elapsedMs = 0;
  private startedAt: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private vehicles: VehicleMarkerData[] = [...MOCK_VEHICLES];
  private trafficLights: TrafficLightMarkerData[] = [...MOCK_TRAFFIC_LIGHTS];
  private congestionSegments: CongestionSegmentData[] = [...MOCK_CONGESTION_SEGMENTS];
  private emergencyRoute: EmergencyRouteData = { ...MOCK_EMERGENCY_ROUTE };
  private metrics: PerformanceMetrics = { ...ZERO_METRICS };
  private benchmark: BenchmarkComparison | null = null;

  private readonly sequential = new SequentialExecutor();
  private readonly parallel = new ParallelExecutor();
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
    this.status = 'idle';
    this.tick = 0;
    this.elapsedMs = 0;
    this.startedAt = null;
    this.vehicles = [...MOCK_VEHICLES];
    this.metrics = { ...ZERO_METRICS };
    this.benchmark = null;
    this.emit();
  }

  updateConfig(patch: Partial<SimulationConfig>): void {
    const wasRunning = this.status === 'running';
    if (wasRunning) this.clearLoop();
    this.config = { ...this.config, ...patch };
    if (wasRunning) this.scheduleLoop();
  }

  getSnapshot(): SimulationSnapshot {
    return {
      tick: this.tick,
      elapsedMs: this.elapsedMs,
      status: this.status,
      config: { ...this.config },
      vehicles: [...this.vehicles],
      trafficLights: [...this.trafficLights],
      congestionSegments: [...this.congestionSegments],
      emergencyRoute: { ...this.emergencyRoute },
      metrics: { ...this.metrics },
      benchmark: this.benchmark,
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
    if (this.status !== 'running') return;

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

    const wallMs = performance.now() - wallStart;

    this.metrics = {
      activeVehicles: this.vehicles.length,
      congestionLevel: 0.3 + Math.sin(this.tick * 0.04) * 0.25,
      avgEmergencyResponseMs: 0,
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
  }

  private emit(): void {
    this.onSnapshotCb?.(this.getSnapshot());
  }
}
