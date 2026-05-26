import { create } from 'zustand';
import type {
  SimulationStatus,
  SimulationConfig,
} from '@/src/types/simulation';

interface SimulationStore {
  status: SimulationStatus;
  config: SimulationConfig;
  tick: number;
  elapsedMs: number;
  startedAt: number | null;
  setStatus: (status: SimulationStatus) => void;
  updateConfig: (patch: Partial<SimulationConfig>) => void;
  setTickAndElapsed: (tick: number, elapsedMs: number) => void;
  incrementTick: () => void;
  reset: () => void;
}

const DEFAULT_CONFIG: SimulationConfig = {
  mode: 'parallel',
  speed: 1,
  vehicleCount: 50,
  scenario: 'morning-rush',
  compareMode: false,
  parallelAdvantageActive: false,
};

export const useSimulationStore = create<SimulationStore>()((set) => ({
  status: 'idle',
  config: DEFAULT_CONFIG,
  tick: 0,
  elapsedMs: 0,
  startedAt: null,
  setStatus: (status) => set({ status }),
  updateConfig: (patch) =>
    set((state) => ({ config: { ...state.config, ...patch } })),
  setTickAndElapsed: (tick, elapsedMs) => set({ tick, elapsedMs }),
  incrementTick: () => set((state) => ({ tick: state.tick + 1 })),
  reset: () => set({ status: 'idle', tick: 0, elapsedMs: 0, startedAt: null }),
}));
