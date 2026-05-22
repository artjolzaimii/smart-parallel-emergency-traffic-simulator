import type { Incident, IncidentType, IncidentSeverity } from '../../types/incident';
import type { RoadNode, RoadEdge } from '../pathfinding/roadGraph';

const DURATION: Record<IncidentSeverity, number> = { low: 40, medium: 60, high: 80 };
const CONGESTION: Record<IncidentType, number> = {
  accident: 0.6,
  blocked: 0.8,
  'congestion-spike': 0.5,
};

const INCIDENT_TYPES: IncidentType[] = ['accident', 'blocked', 'congestion-spike'];
const MAX_AUTO = 3;
const MAX_TOTAL = 5;

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private readonly rng = makeLcg(0xdeadbeef);
  private readonly eligibleNodes: RoadNode[];
  private readonly nodeEdges: Map<string, string[]>;
  private readonly edgeFromNode: Map<string, string>; // edgeId → nodeId (from)

  constructor(nodes: RoadNode[], edges: RoadEdge[], startId: string, goalId: string) {
    // Exclude start and goal nodes to prevent incidents blocking the ambulance's origin/destination
    this.eligibleNodes = nodes.filter((n) => n.id !== startId && n.id !== goalId);

    this.nodeEdges = new Map();
    this.edgeFromNode = new Map();
    for (const edge of edges) {
      const list = this.nodeEdges.get(edge.from) ?? [];
      list.push(edge.id);
      this.nodeEdges.set(edge.from, list);
      this.edgeFromNode.set(edge.id, edge.from);
    }
  }

  tick(tickNum: number): void {
    for (const [id, incident] of this.incidents) {
      if (tickNum >= incident.resolveAtTick) this.incidents.delete(id);
    }
    const autoCount = Array.from(this.incidents.values()).filter((i) => !i.id.startsWith('inc-manual')).length;
    if (tickNum % 15 === 0 && this.rng() < 0.25 && autoCount < MAX_AUTO) {
      this.spawn('medium', tickNum, false);
    }
  }

  createManual(tickNum: number, preferredEdgeIds: string[] = []): void {
    if (this.incidents.size >= MAX_TOTAL) return;
    // Prefer spawning on the active emergency route if edge IDs are provided
    if (preferredEdgeIds.length > 0) {
      const shuffled = [...preferredEdgeIds].sort(() => this.rng() - 0.5);
      for (const edgeId of shuffled.slice(0, 4)) {
        if (this.spawnOnEdge('high', tickNum, true, edgeId)) return;
      }
    }
    this.spawn('high', tickNum, true);
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

  private spawnOnEdge(severity: IncidentSeverity, tickNum: number, manual: boolean, edgeId: string): boolean {
    const nodeId = this.edgeFromNode.get(edgeId);
    if (!nodeId) return false;
    const node = this.eligibleNodes.find((n) => n.id === nodeId);
    if (!node) return false;
    this.spawnAtNode(node, [edgeId], severity, tickNum, manual);
    return true;
  }

  private spawn(severity: IncidentSeverity, tickNum: number, manual: boolean): void {
    if (this.eligibleNodes.length === 0) return;
    const node = this.eligibleNodes[Math.floor(this.rng() * this.eligibleNodes.length)];
    const type = INCIDENT_TYPES[Math.floor(this.rng() * INCIDENT_TYPES.length)];

    const edgeIds = this.nodeEdges.get(node.id) ?? [];
    if (edgeIds.length === 0) return;

    const shuffled = [...edgeIds].sort(() => this.rng() - 0.5);
    const count = type === 'congestion-spike' ? Math.min(2, shuffled.length) : 1;
    this.spawnAtNode(node, shuffled.slice(0, count), severity, tickNum, manual);
  }

  private spawnAtNode(
    node: RoadNode,
    affectedEdgeIds: string[],
    severity: IncidentSeverity,
    tickNum: number,
    manual: boolean,
  ): void {
    const type = INCIDENT_TYPES[Math.floor(this.rng() * INCIDENT_TYPES.length)];
    const prefix = manual ? 'inc-manual' : 'inc';
    const id = `${prefix}-${tickNum}-${Math.floor(this.rng() * 9999)}`;
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
