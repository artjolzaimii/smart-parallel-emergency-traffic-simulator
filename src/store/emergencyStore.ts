import { create } from 'zustand';
import type { Incident } from '@/src/types/incident';
import type { TrafficLightMarkerData, EmergencyRouteData } from '@/src/types/map';
import type { DispatchState } from '@/src/types/emergency';

interface EmergencyStore {
  incidents: Incident[];
  rerouteCount: number;
  autoRerouteEnabled: boolean;
  emergencyPriorityEnabled: boolean;
  routeQualityScore: number;
  emergencyActive: boolean;
  trafficLightMarkers: TrafficLightMarkerData[];
  emergencyRoute: EmergencyRouteData | null;
  dispatchState: DispatchState | null;
  setIncidents: (incidents: Incident[]) => void;
  setRerouteCount: (n: number) => void;
  setAutoReroute: (enabled: boolean) => void;
  setEmergencyPriority: (enabled: boolean) => void;
  setRouteQualityScore: (score: number) => void;
  setEmergencyActive: (active: boolean) => void;
  setTrafficLightMarkers: (markers: TrafficLightMarkerData[]) => void;
  setEmergencyRoute: (route: EmergencyRouteData | null) => void;
  setDispatchState: (ds: DispatchState | null) => void;
  reset: () => void;
}

export const useEmergencyStore = create<EmergencyStore>()((set) => ({
  incidents: [],
  rerouteCount: 0,
  autoRerouteEnabled: true,
  emergencyPriorityEnabled: true,
  routeQualityScore: 100,
  emergencyActive: false,
  trafficLightMarkers: [],
  emergencyRoute: null,
  dispatchState: null,
  setIncidents: (incidents) => set({ incidents }),
  setRerouteCount: (rerouteCount) => set({ rerouteCount }),
  setAutoReroute: (autoRerouteEnabled) => set({ autoRerouteEnabled }),
  setEmergencyPriority: (emergencyPriorityEnabled) => set({ emergencyPriorityEnabled }),
  setRouteQualityScore: (routeQualityScore) => set({ routeQualityScore }),
  setEmergencyActive: (emergencyActive) => set({ emergencyActive }),
  setTrafficLightMarkers: (trafficLightMarkers) => set({ trafficLightMarkers }),
  setEmergencyRoute: (emergencyRoute) => set({ emergencyRoute }),
  setDispatchState: (dispatchState) => set({ dispatchState }),
  reset: () => set({ incidents: [], rerouteCount: 0, routeQualityScore: 100, emergencyActive: false, dispatchState: null }),
}));
