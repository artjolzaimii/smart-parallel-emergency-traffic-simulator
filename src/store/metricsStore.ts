import { create } from 'zustand';
import type { PerformanceMetrics, BenchmarkComparison } from '@/src/types/metrics';
import type { RoutingResult } from '@/src/types/emergency';

const DEFAULT_METRICS: PerformanceMetrics = {
  activeVehicles: 0,
  congestionLevel: 0,
  avgEmergencyResponseMs: 0,
  workerThreadCount: 0,
  tickRateHz: 0,
  cpuUsagePercent: 0,
};

interface MetricsStore {
  metrics: PerformanceMetrics;
  benchmark: BenchmarkComparison | null;
  routing: RoutingResult | null;
  updateMetrics: (patch: Partial<PerformanceMetrics>) => void;
  setBenchmark: (benchmark: BenchmarkComparison | null) => void;
  setRouting: (result: RoutingResult | null) => void;
  reset: () => void;
}

export const useMetricsStore = create<MetricsStore>()((set) => ({
  metrics: DEFAULT_METRICS,
  benchmark: null,
  routing: null,
  updateMetrics: (patch) =>
    set((state) => ({ metrics: { ...state.metrics, ...patch } })),
  setBenchmark: (benchmark) => set({ benchmark }),
  setRouting: (routing) => set({ routing }),
  reset: () => set({ metrics: DEFAULT_METRICS, benchmark: null, routing: null }),
}));
