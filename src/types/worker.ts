export type WorkerDomain = 'vehicle' | 'traffic' | 'congestion' | 'emergency';
export type WorkerStatus = 'idle' | 'busy' | 'error';

export interface WorkerMessage<T = unknown> {
  workerId: string;
  domain: WorkerDomain;
  type: string;
  payload: T;
  timestamp: number;
}

export interface WorkerState {
  id: string;
  domain: WorkerDomain;
  status: WorkerStatus;
  processedTicks: number;
  avgTickMs: number;
}
