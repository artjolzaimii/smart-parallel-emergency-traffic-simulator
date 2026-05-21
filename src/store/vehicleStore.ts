import { create } from 'zustand';
import type { VehicleMarkerData } from '@/src/types/map';

interface VehicleStore {
  vehicles: VehicleMarkerData[];
  setVehicles: (vehicles: VehicleMarkerData[]) => void;
  updateVehicle: (id: string, patch: Partial<VehicleMarkerData>) => void;
  clear: () => void;
}

export const useVehicleStore = create<VehicleStore>()((set) => ({
  vehicles: [],
  setVehicles: (vehicles) => set({ vehicles }),
  updateVehicle: (id, patch) =>
    set((state) => ({
      vehicles: state.vehicles.map((v) =>
        v.id === id ? { ...v, ...patch } : v,
      ),
    })),
  clear: () => set({ vehicles: [] }),
}));
