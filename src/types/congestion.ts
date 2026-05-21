export type CongestionLevel = 'free' | 'moderate' | 'heavy' | 'gridlock';

export interface RoadSegment {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  congestionLevel: CongestionLevel;
  density: number;
  speedFactor: number;
}

export interface CongestionSnapshot {
  timestamp: number;
  segments: RoadSegment[];
  globalCongestion: number;
}
