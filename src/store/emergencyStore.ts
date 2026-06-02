import { create } from 'zustand';
import type { Incident } from '@/src/types/incident';
import type { TrafficLightMarkerData, EmergencyRouteData } from '@/src/types/map';
import type { DispatchState, DispatcherComparison, NormalDispatchComparison, AdvantageWorkload } from '@/src/types/emergency';
import type { SimulationEvent } from '@/src/types/events';

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
  // Compare Dispatchers / Parallel Advantage Scenario mode
  dispatcherComparison: DispatcherComparison | null;
  compareEmergencyRoute: EmergencyRouteData | null;
  // Normal-mode dispatcher comparison (always computed after Trigger Emergency)
  normalDispatchComparison: NormalDispatchComparison | null;
  parallelAdvantageActive: boolean;
  advantageWorkload: AdvantageWorkload | null;
  // Event log (most recent first, max 20)
  events: SimulationEvent[];

  setIncidents: (incidents: Incident[]) => void;
  setRerouteCount: (n: number) => void;
  setAutoReroute: (enabled: boolean) => void;
  setEmergencyPriority: (enabled: boolean) => void;
  setRouteQualityScore: (score: number) => void;
  setEmergencyActive: (active: boolean) => void;
  setTrafficLightMarkers: (markers: TrafficLightMarkerData[]) => void;
  setEmergencyRoute: (route: EmergencyRouteData | null) => void;
  setDispatchState: (ds: DispatchState | null) => void;
  setDispatcherComparison: (dc: DispatcherComparison | null) => void;
  setCompareEmergencyRoute: (route: EmergencyRouteData | null) => void;
  setNormalDispatchComparison: (c: NormalDispatchComparison | null) => void;
  setParallelAdvantageActive: (active: boolean) => void;
  setAdvantageWorkload: (w: AdvantageWorkload | null) => void;
  setEvents: (events: SimulationEvent[]) => void;
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
  dispatcherComparison: null,
  compareEmergencyRoute: null,
  normalDispatchComparison: null,
  parallelAdvantageActive: false,
  advantageWorkload: null,
  events: [],

  setIncidents: (incidents) => set({ incidents }),
  setRerouteCount: (rerouteCount) => set({ rerouteCount }),
  setAutoReroute: (autoRerouteEnabled) => set({ autoRerouteEnabled }),
  setEmergencyPriority: (emergencyPriorityEnabled) => set({ emergencyPriorityEnabled }),
  setRouteQualityScore: (routeQualityScore) => set({ routeQualityScore }),
  setEmergencyActive: (emergencyActive) => set({ emergencyActive }),
  setTrafficLightMarkers: (trafficLightMarkers) => set({ trafficLightMarkers }),
  setEmergencyRoute: (emergencyRoute) => set({ emergencyRoute }),
  setDispatchState: (dispatchState) => set({ dispatchState }),
  setDispatcherComparison: (dispatcherComparison) => set({ dispatcherComparison }),
  setCompareEmergencyRoute: (compareEmergencyRoute) => set({ compareEmergencyRoute }),
  setNormalDispatchComparison: (normalDispatchComparison) => set({ normalDispatchComparison }),
  setParallelAdvantageActive: (parallelAdvantageActive) => set({ parallelAdvantageActive }),
  setAdvantageWorkload: (advantageWorkload) => set({ advantageWorkload }),
  setEvents: (events) => set({ events }),
  reset: () => set({
    incidents: [],
    rerouteCount: 0,
    routeQualityScore: 100,
    emergencyActive: false,
    dispatchState: null,
    dispatcherComparison: null,
    compareEmergencyRoute: null,
    normalDispatchComparison: null,
    parallelAdvantageActive: false,
    advantageWorkload: null,
    events: [],
  }),
}));
