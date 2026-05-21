import type { Incident, IncidentType, IncidentSeverity } from '../../types/incident';
import { TIRANA_NODES, TIRANA_BASE_EDGES } from '../pathfinding/tiranaRoadGraph';

const ELIGIBLE_NODES = TIRANA_NODES.filter((n) => n.id !== 'N01' && n.id !== 'N07');

const DURATION: Record<IncidentSeverity, number> = { low: 40, medium: 60, high: 80 };
const CONGESTION: Record<IncidentType, number> = {
  accident: 0.6,
  blocked: 0.8,
  'congestion-spike': 0.5,
};

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const INCIDENT_TYPES: IncidentType[] = ['accident', 'blocked', 'congestion-spike'];
const MAX_AUTO = 3;
const MAX_TOTAL = 5;

export class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private readonly rng = makeLcg(0xdeadbeef);
  private readonly nodeEdges: Map<string, string[]>;

  constructor() {
    this.nodeEdges = new Map();
    for (const edge of TIRANA_BASE_EDGES) {
      let list = this.nodeEdges.get(edge.from);
      if (!list) { list = []; this.nodeEdges.set(edge.from, list); }
      list.push(edge.id);
    }
  }

  tick(tickNum: number): void {
    for (const [id, incident] of this.incidents) {
      if (tickNum >= incident.resolveAtTick) this.incidents.delete(id);
    }

    if (tickNum % 15 === 0 && this.rng() < 0.25 && this.incidents.size < MAX_AUTO) {
      this.spawn('medium', tickNum);
    }
  }

  createManual(tickNum: number): void {
    if (this.incidents.size >= MAX_TOTAL) return;
    this.spawn('high', tickNum);
  }

  getActive(): Incident[] {
    return Array.from(this.incidents.values());
  }

  getEdgeOverrides(): { edgeId: string; congestionBoost: number; blocked: boolean }[] {
    const result: { edgeId: string; congestionBoost: number; blocked: boolean }[] = [];
    for (const incident of this.incidents.values()) {
      for (const edgeId of incident.affectedEdgeIds) {
        result.push({ edgeId, congestionBoost: incident.congestionBoost, blocked: incident.blocked });
      }
    }
    return result;
  }

  reset(): void {
    this.incidents.clear();
  }

  private spawn(severity: IncidentSeverity, tickNum: number): void {
    const node = ELIGIBLE_NODES[Math.floor(this.rng() * ELIGIBLE_NODES.length)];
    const type = INCIDENT_TYPES[Math.floor(this.rng() * INCIDENT_TYPES.length)];

    const edgeIds = this.nodeEdges.get(node.id) ?? [];
    if (edgeIds.length === 0) return;

    // Shuffle and pick 1–2 edges
    const shuffled = [...edgeIds].sort(() => this.rng() - 0.5);
    const count = type === 'congestion-spike' ? Math.min(2, shuffled.length) : 1;
    const affectedEdgeIds = shuffled.slice(0, count);

    const id = `inc-${tickNum}-${Math.floor(this.rng() * 9999)}`;
    this.incidents.set(id, {
      id,
      type,
      severity,
      nodeId: node.id,
      affectedEdgeIds,
      position: { ...node.position },
      createdAtTick: tickNum,
      resolveAtTick: tickNum + DURATION[severity],
      congestionBoost: CONGESTION[type],
      blocked: type === 'blocked',
    });
  }
}
