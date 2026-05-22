import { create } from 'zustand';
import type { PerformanceMetrics, BenchmarkComparison } from '@/src/types/metrics';
import type { RoutingResult } from '@/src/types/emergency';
import type { SyncMetrics } from '@/src/types/simulation';

const DEFAULT_METRICS: PerformanceMetrics = {
  activeVehicles: 0,
  congestionLevel: 0,
  avgEmergencyResponseMs: 0,
  workerThreadCount: 0,
  tickRateHz: 0,
  cpuUsagePercent: 0,
};

const DEFAULT_SYNC: SyncMetrics = {
  semaphoreAcquisitions: 0,
  semaphoreWaits: 0,
  blockedThisTick: 0,
  controlledIntersections: 0,
  emergencyProduced: 0,
  emergencyConsumed: 0,
  emergencyPending: 0,
};

interface MetricsStore {
  metrics: PerformanceMetrics;
  benchmark: BenchmarkComparison | null;
  routing: RoutingResult | null;
  syncMetrics: SyncMetrics;
  updateMetrics: (patch: Partial<PerformanceMetrics>) => void;
  setBenchmark: (benchmark: BenchmarkComparison | null) => void;
  setRouting: (result: RoutingResult | null) => void;
  setSyncMetrics: (s: SyncMetrics) => void;
  reset: () => void;
}

export const useMetricsStore = create<MetricsStore>()((set) => ({
  metrics: DEFAULT_METRICS,
  benchmark: null,
  routing: null,
  syncMetrics: DEFAULT_SYNC,
  updateMetrics: (patch) =>
    set((state) => ({ metrics: { ...state.metrics, ...patch } })),
  setBenchmark: (benchmark) => set({ benchmark }),
  setRouting: (routing) => set({ routing }),
  setSyncMetrics: (syncMetrics) => set({ syncMetrics }),
  reset: () => set({ metrics: DEFAULT_METRICS, benchmark: null, routing: null, syncMetrics: DEFAULT_SYNC }),
}));
