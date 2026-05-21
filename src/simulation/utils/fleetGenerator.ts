import type { VehicleMarkerData } from '../../types/map';
import type { VehicleType } from '../../types/vehicle';

const LAT_MIN = 41.315;
const LAT_MAX = 41.345;
const LNG_MIN = 19.800;
const LNG_MAX = 19.840;

const CIVILIAN_TYPES: VehicleType[] = [
  'car', 'car', 'car', 'car', 'car', 'car', 'car',
  'truck', 'truck',
  'motorcycle', 'motorcycle', 'motorcycle',
];

// Linear-congruential RNG — deterministic for a given count seed
function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function generateFleet(count: number): VehicleMarkerData[] {
  const rng = makeLcg(count * 31337);
  const fleet: VehicleMarkerData[] = [];

  // Index 0 is always the ambulance at Skanderbeg Square
  fleet.push({
    id: 'ev-001',
    type: 'emergency',
    isEmergency: true,
    position: { lat: 41.3286, lng: 19.8193 },
    label: 'AMB-01',
  });

  for (let i = 1; i < count; i++) {
    const type = CIVILIAN_TYPES[Math.floor(rng() * CIVILIAN_TYPES.length)];
    fleet.push({
      id: `v-${String(i).padStart(3, '0')}`,
      type,
      isEmergency: false,
      position: {
        lat: LAT_MIN + rng() * (LAT_MAX - LAT_MIN),
        lng: LNG_MIN + rng() * (LNG_MAX - LNG_MIN),
      },
    });
  }

  return fleet;
}
