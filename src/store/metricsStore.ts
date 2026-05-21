import { create } from 'zustand';
import type { PerformanceMetrics, BenchmarkComparison } from '@/src/types/metrics';

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
  updateMetrics: (patch: Partial<PerformanceMetrics>) => void;
  setBenchmark: (benchmark: BenchmarkComparison | null) => void;
  reset: () => void;
}

export const useMetricsStore = create<MetricsStore>()((set) => ({
  metrics: DEFAULT_METRICS,
  benchmark: null,
  updateMetrics: (patch) =>
    set((state) => ({ metrics: { ...state.metrics, ...patch } })),
  setBenchmark: (benchmark) => set({ benchmark }),
  reset: () => set({ metrics: DEFAULT_METRICS, benchmark: null }),
}));
