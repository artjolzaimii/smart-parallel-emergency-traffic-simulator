import { create } from 'zustand';
import type { TrafficLight, Intersection } from '@/src/types/traffic';

interface TrafficStore {
  lights: TrafficLight[];
  intersections: Intersection[];
  setLights: (lights: TrafficLight[]) => void;
  setIntersections: (intersections: Intersection[]) => void;
  clear: () => void;
}

export const useTrafficStore = create<TrafficStore>()((set) => ({
  lights: [],
  intersections: [],
  setLights: (lights) => set({ lights }),
  setIntersections: (intersections) => set({ intersections }),
  clear: () => set({ lights: [], intersections: [] }),
}));
