export interface GeoPosition {
  lat: number;
  lng: number;
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'stopped';
export type SimulationMode = 'sequential' | 'parallel';
export type SimulationScenario =
  | 'morning-rush'
  | 'evening-rush'
  | 'emergency-incident'
  | 'night-low';

export interface SimulationConfig {
  mode: SimulationMode;
  speed: number;
  vehicleCount: number;
  scenario: SimulationScenario;
}

export interface SimulationState {
  status: SimulationStatus;
  config: SimulationConfig;
  tick: number;
  elapsedMs: number;
  startedAt: number | null;
}

export interface SyncMetrics {
  semaphoreAcquisitions: number;
  semaphoreWaits: number;
  blockedThisTick: number;
  controlledIntersections: number;
  emergencyProduced: number;
  emergencyConsumed: number;
  emergencyPending: number;
}
