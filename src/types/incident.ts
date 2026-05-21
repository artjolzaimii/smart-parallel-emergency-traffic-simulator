import type { GeoPosition } from './simulation';

export type IncidentType = 'accident' | 'blocked' | 'congestion-spike';
export type IncidentSeverity = 'low' | 'medium' | 'high';

export interface Incident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  nodeId: string;
  affectedEdgeIds: string[];
  position: GeoPosition;
  createdAtTick: number;
  resolveAtTick: number;
  congestionBoost: number;
  blocked: boolean;
}
