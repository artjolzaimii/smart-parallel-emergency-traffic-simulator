import type { VehicleMarkerData } from '../../types/map';
import type { VehicleType } from '../../types/vehicle';
import type { LoadedGraph } from '../pathfinding/loadRoadGraph';
import type { VehicleGraphState } from '../vehicles/VehicleGraphState';
import { interpolateEdge } from '../vehicles/VehicleMovement';

const CIVILIAN_TYPES: VehicleType[] = [
  'car', 'car', 'car', 'car', 'car', 'car', 'car',
  'truck', 'truck',
  'motorcycle', 'motorcycle', 'motorcycle',
];

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function generateFleet(
  count: number,
  graph: LoadedGraph,
): { vehicles: VehicleMarkerData[]; graphStates: VehicleGraphState[] } {
  const rng = makeLcg(count * 31337);
  const vehicles: VehicleMarkerData[] = [];
  const graphStates: VehicleGraphState[] = [];

  // Only edges that have proper coordinate geometry for interpolation
  const drivable = graph.edges.filter((e) => e.coordinates && e.coordinates.length >= 2);
  const edgePool = drivable.length > 0 ? drivable : graph.edges;

  // Ambulance: fixed at start node, not auto-moved
  const startNode = graph.nodesMap.get(graph.startNodeId) ?? graph.nodes[0];
  vehicles.push({
    id: 'ev-001',
    type: 'emergency',
    isEmergency: true,
    position: startNode.position,
    label: 'AMB-01',
  });
  graphStates.push({ id: 'ev-001', edgeId: edgePool[0]?.id ?? '', progress: 0 });

  // Civilian vehicles placed on random edges at random progress
  for (let i = 1; i < count; i++) {
    const type = CIVILIAN_TYPES[Math.floor(rng() * CIVILIAN_TYPES.length)];
    const edge = edgePool[Math.floor(rng() * edgePool.length)];
    const progress = rng();
    const position = interpolateEdge(edge, progress);
    const id = `v-${String(i).padStart(3, '0')}`;
    vehicles.push({ id, type, isEmergency: false, position });
    graphStates.push({ id, edgeId: edge.id, progress });
  }

  return { vehicles, graphStates };
}
