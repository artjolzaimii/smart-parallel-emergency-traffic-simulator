export type WsMessageType =
  | 'simulation:state'
  | 'vehicles:update'
  | 'traffic:update'
  | 'congestion:update'
  | 'emergency:event'
  | 'metrics:update'
  | 'control:command';

export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  timestamp: number;
  sequenceId: number;
}

export interface WsControlCommand {
  action: 'start' | 'pause' | 'reset' | 'configure';
  params?: Record<string, unknown>;
}
