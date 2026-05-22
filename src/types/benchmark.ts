export type BenchmarkMode = 'sequential' | 'parallel' | 'comparison';

export interface BenchmarkRunResult {
  mode: 'sequential' | 'parallel';
  candidateCount: number;
  iterationCount: number;
  totalMs: number;
  avgIterationMs: number;
  throughputCandidatesPerSec: number;
  workerCount: number;
}

export interface FullBenchmarkResult {
  candidateCount: number;
  iterationCount: number;
  mode: BenchmarkMode;
  sequential: BenchmarkRunResult | null;
  parallel: BenchmarkRunResult | null;
  // Populated only when both sides ran
  speedup: number | null;
  efficiency: number | null;
  improvementPct: number | null;
  timestamp: number;
}
