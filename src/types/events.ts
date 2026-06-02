export type SimulationEventType =
  | 'emergency_triggered'
  | 'seq_route_computed'
  | 'par_route_computed'
  | 'dispatch_started'
  | 'incident_created'
  | 'route_blocked'
  | 'reroute_started'
  | 'reroute_completed'
  | 'arrived'
  | 'demo_started'
  | 'demo_complete';

export interface SimulationEvent {
  id: string;
  type: SimulationEventType;
  tick: number;
  label: string;
  detail?: string;
}
