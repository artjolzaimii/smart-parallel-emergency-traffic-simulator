export interface PerformanceMetrics {
  activeVehicles: number;
  congestionLevel: number;
  avgEmergencyResponseMs: number;
  workerThreadCount: number;
  tickRateHz: number;
  cpuUsagePercent: number;
}

export interface BenchmarkComparison {
  sequentialTickMs: number;
  parallelTickMs: number;
  speedupFactor: number;
  throughputVehiclesPerSecond: number;
}

export interface MetricsSnapshot {
  timestamp: number;
  metrics: PerformanceMetrics;
  benchmark: BenchmarkComparison | null;
}
