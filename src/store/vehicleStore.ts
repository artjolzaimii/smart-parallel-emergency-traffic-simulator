import { create } from 'zustand';
import type { Vehicle } from '@/src/types/vehicle';

interface VehicleStore {
  vehicles: Vehicle[];
  setVehicles: (vehicles: Vehicle[]) => void;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
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
