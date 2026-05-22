import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { RoadNode, RoadEdge } from './roadGraph';
import {
  TIRANA_NODES,
  TIRANA_BASE_EDGES,
  AMBULANCE_START_NODE,
  HOSPITAL_NODE,
} from './tiranaRoadGraph';

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
      return finalize(raw.nodes, raw.edges, raw.adjacency, raw.startNodeId, raw.goalNodeId, 'osm');
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
  return {
    nodes,
    edges,
    nodesMap: new Map(nodes.map((n) => [n.id, n])),
    edgesMap: new Map(edges.map((e) => [e.id, e])),
    adjacency,
    startNodeId,
    goalNodeId,
    source,
  };
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
