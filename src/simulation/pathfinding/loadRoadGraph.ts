import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { RoadNode, RoadEdge } from './roadGraph';
import {
  TIRANA_NODES,
  TIRANA_BASE_EDGES,
  AMBULANCE_START_NODE,
  HOSPITAL_NODE,
} from './tiranaRoadGraph';

// Desired emergency dispatch origin — Grand Park / Artificial Lake area.
// loadRoadGraph always selects the nearest graph node to these coords so
// the origin is correct even if the cached startNodeId was generated with
// an older START_TARGET in generateRoads.ts.
const EMERGENCY_START_COORDS = { lat: 41.310370, lng: 19.808463 };

export interface LoadedGraph {
  nodes: RoadNode[];
  edges: RoadEdge[];
  nodesMap: Map<string, RoadNode>;
  edgesMap: Map<string, RoadEdge>;
  adjacency: Record<string, string[]>; // nodeId → edgeIds from that node
  startNodeId: string;
  goalNodeId: string;
  source: 'osm' | 'mock';
}

const GRAPH_PATH = join(process.cwd(), 'data/roads/tirana-road-graph.json');

export function loadRoadGraph(): LoadedGraph {
  if (existsSync(GRAPH_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(GRAPH_PATH, 'utf-8')) as {
        nodes: RoadNode[];
        edges: RoadEdge[];
        adjacency: Record<string, string[]>;
        startNodeId: string;
        goalNodeId: string;
      };
      console.log(
        `[Graph] Loaded OSM cache: ${raw.nodes.length} nodes, ${raw.edges.length} edges`,
      );
      // Always recompute startNodeId as the nearest node to the configured dispatch
      // origin so the correct location is used regardless of when the cache was generated.
      const startNodeId = nearestNodeId(raw.nodes, EMERGENCY_START_COORDS);
      return finalize(raw.nodes, raw.edges, raw.adjacency, startNodeId, raw.goalNodeId, 'osm');
    } catch (err) {
      console.warn('[Graph] Failed to parse tirana-road-graph.json — using mock graph:', err);
    }
  } else {
    console.log('[Graph] No OSM cache found — using mock graph. Run: npm run generate:roads');
  }

  // Fallback: mock graph with synthetic two-point coordinates on each edge
  const nodes = TIRANA_NODES as RoadNode[];
  const edges = enrichMockEdges(TIRANA_BASE_EDGES, nodes);
  const adjacency = buildAdjacency(edges);
  return finalize(nodes, edges, adjacency, AMBULANCE_START_NODE, HOSPITAL_NODE, 'mock');
}

function finalize(
  nodes: RoadNode[],
  edges: RoadEdge[],
  adjacency: Record<string, string[]>,
  startNodeId: string,
  goalNodeId: string,
  source: 'osm' | 'mock',
): LoadedGraph {
  const nodesMap = new Map(nodes.map((n) => [n.id, n]));

  const startNode = nodesMap.get(startNodeId);
  const goalNode  = nodesMap.get(goalNodeId);

  const distM = startNode
    ? Math.round(haversineM(startNode.position, EMERGENCY_START_COORDS))
    : -1;
  const distNote = distM >= 0 ? `  (${distM}m from requested origin)` : '';

  console.log(`[Graph] Emergency start node: ${startNodeId}`);
  console.log(`[Graph] Emergency start coords: ${startNode?.position.lat.toFixed(6) ?? '?'}, ${startNode?.position.lng.toFixed(6) ?? '?'}${distNote}`);
  console.log(`[Graph] Emergency destination: ${goalNodeId}  ${goalNode?.position.lat.toFixed(6) ?? '?'}, ${goalNode?.position.lng.toFixed(6) ?? '?'}`);

  return {
    nodes,
    edges,
    nodesMap,
    edgesMap: new Map(edges.map((e) => [e.id, e])),
    adjacency,
    startNodeId,
    goalNodeId,
    source,
  };
}

function nearestNodeId(
  nodes: RoadNode[],
  target: { lat: number; lng: number },
): string {
  let bestId = nodes[0].id;
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = haversineM(n.position, target);
    if (d < bestDist) { bestDist = d; bestId = n.id; }
  }
  return bestId;
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function buildAdjacency(edges: RoadEdge[]): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!adj[edge.from]) adj[edge.from] = [];
    adj[edge.from].push(edge.id);
  }
  return adj;
}

// Populate two-point coordinates on mock edges so vehicles can interpolate position
function enrichMockEdges(edges: RoadEdge[], nodes: RoadNode[]): RoadEdge[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return edges.map((e) => {
    if (e.coordinates) return e;
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    return from && to ? { ...e, coordinates: [from.position, to.position] } : e;
  });
}
