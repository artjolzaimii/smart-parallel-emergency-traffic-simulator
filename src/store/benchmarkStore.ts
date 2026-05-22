import { create } from 'zustand';
import type { FullBenchmarkResult } from '@/src/types/benchmark';

interface BenchmarkStore {
  running: boolean;
  progress: number | null;
  result: FullBenchmarkResult | null;
  history: FullBenchmarkResult[];
  setRunning: (v: boolean) => void;
  setProgress: (v: number | null) => void;
  setResult: (r: FullBenchmarkResult | null) => void;
  pushHistory: (r: FullBenchmarkResult) => void;
}

export const useBenchmarkStore = create<BenchmarkStore>()((set) => ({
  running: false,
  progress: null,
  result: null,
  history: [],
  setRunning: (running) => set({ running }),
  setProgress: (progress) => set({ progress }),
  setResult: (result) => set({ result }),
  pushHistory: (r) =>
    set((state) => ({ history: [r, ...state.history].slice(0, 10) })),
}));
