/**
 * Fetches driving roads for central Tirana from the Overpass API,
 * converts them to the internal RoadGraph format, and caches the result
 * at data/roads/tirana-road-graph.json.
 *
 * Usage:
 *   npm run generate:roads
 *
 * The app reads the cached file at startup; this script only needs to run once
 * (or whenever you want fresh OSM data).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Config ────────────────────────────────────────────────────────────────────

const BBOX = { south: 41.315, west: 19.795, north: 41.348, east: 19.845 };

// Mirrors tried in order; first success wins
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

const USER_AGENT =
  'SPERTS-academic-project/1.0 (Smart Parallel Emergency Traffic Simulator; github.com/artjolzaimi)';

// Ambulance start: Skanderbeg Square
const START_TARGET = { lat: 41.3286, lng: 19.8193 };
// Goal: QSUT University Hospital (Spitali i Madh)
const GOAL_TARGET = { lat: 41.3371, lng: 19.8205 };

const SPEED_BY_TYPE: Record<string, number> = {
  primary: 50,
  secondary: 40,
  tertiary: 35,
  residential: 30,
  service: 20,
  unclassified: 30,
};

// ─── Overpass query ────────────────────────────────────────────────────────────

const QUERY = `
[out:json][timeout:40];
(
  way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified)$"]
     (${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out body;
>;
out skel qt;
`.trim();

// ─── OSM types ─────────────────────────────────────────────────────────────────

interface OsmNode { type: 'node'; id: number; lat: number; lon: number }
interface OsmWay  { type: 'way';  id: number; nodes: number[]; tags?: Record<string, string> }
type OsmElement = OsmNode | OsmWay;
interface OverpassResponse { elements: OsmElement[] }

// ─── Graph output types (matches src/simulation/pathfinding/roadGraph.ts) ─────

interface GeoPosition { lat: number; lng: number }
interface RoadNode { id: string; position: GeoPosition }
interface RoadEdge {
  id: string; from: string; to: string;
  coordinates: GeoPosition[];
  distanceM: number; name?: string; roadType: string;
  baseSpeedKph: number; congestion: number; blocked: boolean; trafficLightDelayS: number;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function haversineM(a: GeoPosition, b: GeoPosition): number {
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

function nearestNode(nodes: RoadNode[], target: GeoPosition): string {
  let bestId = nodes[0].id;
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = haversineM(n.position, target);
    if (d < bestDist) { bestDist = d; bestId = n.id; }
  }
  return bestId;
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────

async function tryEndpoint(url: string): Promise<OverpassResponse> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      // Charset is required; some servers return 406 without it
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      // Tell the server we want JSON so content negotiation succeeds
      'Accept': 'application/json',
      // Overpass-API.de policy: requests must carry a descriptive User-Agent
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(QUERY)}`,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  return resp.json() as Promise<OverpassResponse>;
}

async function fetchOverpass(): Promise<OverpassResponse> {
  const errors: string[] = [];

  for (const url of OVERPASS_MIRRORS) {
    console.log(`[generateRoads] Trying endpoint: ${url}`);
    try {
      const data = await tryEndpoint(url);
      console.log(`[generateRoads] Success from ${url}`);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[generateRoads] Failed (${url}): ${msg}`);
      errors.push(`${url} → ${msg}`);
    }
  }

  throw new Error(
    `All Overpass endpoints failed:\n${errors.map((e) => `  • ${e}`).join('\n')}\n\n` +
    'The simulation will continue using the built-in mock graph.\n' +
    'Try again later or check your internet connection.',
  );
}

// ─── OSM → Graph conversion ────────────────────────────────────────────────────

function convertToGraph(data: OverpassResponse): { nodes: RoadNode[]; edges: RoadEdge[] } {
  const osmPos = new Map<number, GeoPosition>();
  const ways: OsmWay[] = [];

  for (const el of data.elements) {
    if (el.type === 'node') osmPos.set(el.id, { lat: el.lat, lng: el.lon });
    if (el.type === 'way' && el.nodes.length >= 2) ways.push(el);
  }

  // Count appearances to identify intersection nodes
  const nodeCount = new Map<number, number>();
  for (const way of ways) {
    for (const nid of way.nodes) nodeCount.set(nid, (nodeCount.get(nid) ?? 0) + 1);
  }

  // Significant = appears in 2+ ways OR is a way endpoint
  const significant = new Set<number>();
  for (const way of ways) {
    significant.add(way.nodes[0]);
    significant.add(way.nodes[way.nodes.length - 1]);
  }
  for (const [nid, count] of nodeCount) {
    if (count >= 2) significant.add(nid);
  }

  // Build graph nodes
  const nodeIdMap = new Map<number, string>();
  const graphNodes: RoadNode[] = [];
  let ni = 0;
  for (const nid of significant) {
    const pos = osmPos.get(nid);
    if (!pos) continue;
    const id = `N${++ni}`;
    nodeIdMap.set(nid, id);
    graphNodes.push({ id, position: pos });
  }

  // Build graph edges
  const graphEdges: RoadEdge[] = [];
  let ei = 0;

  for (const way of ways) {
    const roadType = way.tags?.highway ?? 'unclassified';
    const name = way.tags?.name;
    const speed = SPEED_BY_TYPE[roadType] ?? 30;
    const isOneWay = way.tags?.oneway === 'yes';

    let segStart = 0;
    for (let i = 1; i < way.nodes.length; i++) {
      if (!significant.has(way.nodes[i])) continue;

      const fromId = nodeIdMap.get(way.nodes[segStart]);
      const toId = nodeIdMap.get(way.nodes[i]);
      if (!fromId || !toId || fromId === toId) { segStart = i; continue; }

      // Collect intermediate geometry
      const coords: GeoPosition[] = [];
      for (let j = segStart; j <= i; j++) {
        const pos = osmPos.get(way.nodes[j]);
        if (pos) coords.push(pos);
      }

      // Calculate total segment distance
      let dist = 0;
      for (let j = 1; j < coords.length; j++) dist += haversineM(coords[j - 1], coords[j]);
      if (dist < 1) { segStart = i; continue; }

      const base: Omit<RoadEdge, 'id' | 'from' | 'to' | 'coordinates'> = {
        distanceM: Math.round(dist),
        name,
        roadType,
        baseSpeedKph: speed,
        congestion: 0.3,
        blocked: false,
        trafficLightDelayS: 0,
      };

      graphEdges.push({ id: `E${++ei}`, from: fromId, to: toId, coordinates: coords, ...base });

      if (!isOneWay) {
        graphEdges.push({
          id: `E${++ei}`,
          from: toId,
          to: fromId,
          coordinates: [...coords].reverse(),
          ...base,
        });
      }

      segStart = i;
    }
  }

  return { nodes: graphNodes, edges: graphEdges };
}

function buildAdjacency(edges: RoadEdge[]): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  for (const edge of edges) {
    if (!adj[edge.from]) adj[edge.from] = [];
    adj[edge.from].push(edge.id);
  }
  return adj;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[generateRoads] Fetching from Overpass API…');
  console.log(`[generateRoads] BBox: ${BBOX.south},${BBOX.west} → ${BBOX.north},${BBOX.east}`);

  let data: OverpassResponse;
  try {
    data = await fetchOverpass();
  } catch (err) {
    console.error('\n[generateRoads] Could not fetch road data.');
    console.error(err instanceof Error ? err.message : String(err));
    console.error(
      '\nThe app will still run — it falls back to the built-in mock graph automatically.\n' +
      'Re-run "npm run generate:roads" when you have internet access.\n',
    );
    process.exit(1);
  }

  const osmNodes = data.elements.filter((e) => e.type === 'node').length;
  const osmWays  = data.elements.filter((e) => e.type === 'way').length;
  console.log(`[generateRoads] Received ${osmNodes} OSM nodes, ${osmWays} ways`);

  const { nodes, edges } = convertToGraph(data);
  console.log(`[generateRoads] Graph: ${nodes.length} nodes, ${edges.length} edges`);

  if (nodes.length === 0 || edges.length === 0) {
    console.error('[generateRoads] Empty graph — check Overpass query or bbox');
    process.exit(1);
  }

  const startNodeId = nearestNode(nodes, START_TARGET);
  const goalNodeId  = nearestNode(nodes, GOAL_TARGET);
  const adjacency   = buildAdjacency(edges);

  const startNode = nodes.find((n) => n.id === startNodeId);
  const goalNode  = nodes.find((n) => n.id === goalNodeId);
  console.log(`[generateRoads] Start: ${startNodeId} (${startNode?.position.lat.toFixed(5)}, ${startNode?.position.lng.toFixed(5)}) ≈ Skanderbeg Square`);
  console.log(`[generateRoads] Goal:  ${goalNodeId} (${goalNode?.position.lat.toFixed(5)}, ${goalNode?.position.lng.toFixed(5)}) ≈ QSUT Hospital`);

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      bbox: BBOX,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
    nodes,
    edges,
    adjacency,
    startNodeId,
    goalNodeId,
  };

  const outDir  = join(process.cwd(), 'data/roads');
  const outPath = join(outDir, 'tirana-road-graph.json');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(output));
  console.log(`[generateRoads] Saved ${outPath} (${(JSON.stringify(output).length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error('[generateRoads]', err);
  process.exit(1);
});
