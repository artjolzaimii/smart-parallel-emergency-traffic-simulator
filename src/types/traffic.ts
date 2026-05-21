import type { GeoPosition } from './simulation';

export type TrafficLightPhase = 'green' | 'yellow' | 'red';
export type TrafficLightStatus = 'normal' | 'preempted' | 'flashing';

export interface TrafficLight {
  id: string;
  position: GeoPosition;
  phase: TrafficLightPhase;
  status: TrafficLightStatus;
  phaseRemainingMs: number;
  intersectionId: string;
}

export interface Intersection {
  id: string;
  position: GeoPosition;
  lights: TrafficLight[];
  congestionLevel: number;
}
