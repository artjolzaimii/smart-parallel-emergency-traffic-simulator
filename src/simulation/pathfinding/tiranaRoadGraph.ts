import type { RoadNode, RoadEdge } from './roadGraph';

export const AMBULANCE_START_NODE = 'N01';
export const HOSPITAL_NODE = 'N07';

export const TIRANA_NODES: RoadNode[] = [
  // === Main avenue corridor (N01 → N07) ===
  { id: 'N01', position: { lat: 41.3286, lng: 19.8193 }, label: 'Skanderbeg Square' },
  { id: 'N02', position: { lat: 41.3295, lng: 19.8197 }, label: 'Bul. Dëshmorët nr.1' },
  { id: 'N03', position: { lat: 41.3308, lng: 19.8198 }, label: 'Bul. Dëshmorët nr.2' },
  { id: 'N04', position: { lat: 41.3320, lng: 19.8199 }, label: 'Bul. Dëshmorët / Matohiti' },
  { id: 'N05', position: { lat: 41.3335, lng: 19.8201 }, label: 'Bulevardi nr.3' },
  { id: 'N06', position: { lat: 41.3350, lng: 19.8203 }, label: 'Zogu i Zi Junction' },
  { id: 'N07', position: { lat: 41.3365, lng: 19.8207 }, label: 'QSUT Hospital' },

  // === Eastern corridor: Rruga Dibres ===
  { id: 'N08', position: { lat: 41.3295, lng: 19.8215 }, label: 'Rruga Dibres S' },
  { id: 'N09', position: { lat: 41.3312, lng: 19.8218 }, label: 'Rruga Dibres mid' },
  { id: 'N10', position: { lat: 41.3330, lng: 19.8220 }, label: 'Rruga Dibres N' },

  // === Western corridor: Rruga Mustafa Matohiti ===
  { id: 'N11', position: { lat: 41.3285, lng: 19.8165 }, label: 'Rruga Bogdaneve W' },
  { id: 'N12', position: { lat: 41.3300, lng: 19.8168 }, label: 'Rruga Matohiti S' },
  { id: 'N13', position: { lat: 41.3315, lng: 19.8172 }, label: 'Rruga Matohiti N' },
  { id: 'N14', position: { lat: 41.3340, lng: 19.8185 }, label: 'Rruga Dibres / Matohiti' },

  // === Southern approach ===
  { id: 'N15', position: { lat: 41.3270, lng: 19.8195 }, label: 'Rruga Mine Peza' },
  { id: 'N16', position: { lat: 41.3278, lng: 19.8210 }, label: 'Rruga Elbasanit' },
];

// Bidirectional edges — each road segment has a forward and backward entry
// prettier-ignore
export const TIRANA_BASE_EDGES: RoadEdge[] = [
  // Main avenue: Bulevardi Dëshmorët e Kombit — heaviest traffic
  { id: 'E01',  from: 'N01', to: 'N02', distanceM: 200, baseSpeedKph: 50, congestion: 0.40, trafficLightDelayS: 20, blocked: false },
  { id: 'E01r', from: 'N02', to: 'N01', distanceM: 200, baseSpeedKph: 50, congestion: 0.40, trafficLightDelayS: 10, blocked: false },
  { id: 'E02',  from: 'N02', to: 'N03', distanceM: 280, baseSpeedKph: 50, congestion: 0.60, trafficLightDelayS: 15, blocked: false },
  { id: 'E02r', from: 'N03', to: 'N02', distanceM: 280, baseSpeedKph: 50, congestion: 0.60, trafficLightDelayS: 15, blocked: false },
  { id: 'E03',  from: 'N03', to: 'N04', distanceM: 240, baseSpeedKph: 50, congestion: 0.50, trafficLightDelayS: 20, blocked: false },
  { id: 'E03r', from: 'N04', to: 'N03', distanceM: 240, baseSpeedKph: 50, congestion: 0.50, trafficLightDelayS: 20, blocked: false },
  { id: 'E04',  from: 'N04', to: 'N05', distanceM: 300, baseSpeedKph: 60, congestion: 0.30, trafficLightDelayS: 10, blocked: false },
  { id: 'E04r', from: 'N05', to: 'N04', distanceM: 300, baseSpeedKph: 60, congestion: 0.30, trafficLightDelayS: 10, blocked: false },
  { id: 'E05',  from: 'N05', to: 'N06', distanceM: 300, baseSpeedKph: 60, congestion: 0.20, trafficLightDelayS:  8, blocked: false },
  { id: 'E05r', from: 'N06', to: 'N05', distanceM: 300, baseSpeedKph: 60, congestion: 0.20, trafficLightDelayS:  8, blocked: false },
  { id: 'E06',  from: 'N06', to: 'N07', distanceM: 350, baseSpeedKph: 50, congestion: 0.15, trafficLightDelayS:  5, blocked: false },
  { id: 'E06r', from: 'N07', to: 'N06', distanceM: 350, baseSpeedKph: 50, congestion: 0.15, trafficLightDelayS:  5, blocked: false },

  // Eastern corridor: Rruga Dibres
  { id: 'E07',  from: 'N01', to: 'N08', distanceM: 300, baseSpeedKph: 40, congestion: 0.30, trafficLightDelayS: 15, blocked: false },
  { id: 'E07r', from: 'N08', to: 'N01', distanceM: 300, baseSpeedKph: 40, congestion: 0.30, trafficLightDelayS: 15, blocked: false },
  { id: 'E08',  from: 'N08', to: 'N09', distanceM: 380, baseSpeedKph: 40, congestion: 0.45, trafficLightDelayS: 12, blocked: false },
  { id: 'E08r', from: 'N09', to: 'N08', distanceM: 380, baseSpeedKph: 40, congestion: 0.45, trafficLightDelayS: 12, blocked: false },
  { id: 'E09',  from: 'N09', to: 'N10', distanceM: 380, baseSpeedKph: 40, congestion: 0.35, trafficLightDelayS: 10, blocked: false },
  { id: 'E09r', from: 'N10', to: 'N09', distanceM: 380, baseSpeedKph: 40, congestion: 0.35, trafficLightDelayS: 10, blocked: false },
  { id: 'E10',  from: 'N10', to: 'N07', distanceM: 450, baseSpeedKph: 40, congestion: 0.20, trafficLightDelayS:  8, blocked: false },
  { id: 'E10r', from: 'N07', to: 'N10', distanceM: 450, baseSpeedKph: 40, congestion: 0.20, trafficLightDelayS:  8, blocked: false },

  // Western shortcut: Rruga Mustafa Matohiti — high baseline congestion
  { id: 'E11',  from: 'N01', to: 'N11', distanceM: 350, baseSpeedKph: 40, congestion: 0.70, trafficLightDelayS: 25, blocked: false },
  { id: 'E11r', from: 'N11', to: 'N01', distanceM: 350, baseSpeedKph: 40, congestion: 0.70, trafficLightDelayS: 25, blocked: false },
  { id: 'E12',  from: 'N11', to: 'N12', distanceM: 300, baseSpeedKph: 40, congestion: 0.60, trafficLightDelayS: 18, blocked: false },
  { id: 'E12r', from: 'N12', to: 'N11', distanceM: 300, baseSpeedKph: 40, congestion: 0.60, trafficLightDelayS: 18, blocked: false },
  { id: 'E13',  from: 'N12', to: 'N13', distanceM: 300, baseSpeedKph: 40, congestion: 0.50, trafficLightDelayS: 15, blocked: false },
  { id: 'E13r', from: 'N13', to: 'N12', distanceM: 300, baseSpeedKph: 40, congestion: 0.50, trafficLightDelayS: 15, blocked: false },
  { id: 'E14',  from: 'N13', to: 'N14', distanceM: 550, baseSpeedKph: 50, congestion: 0.25, trafficLightDelayS: 10, blocked: false },
  { id: 'E14r', from: 'N14', to: 'N13', distanceM: 550, baseSpeedKph: 50, congestion: 0.25, trafficLightDelayS: 10, blocked: false },
  { id: 'E15',  from: 'N14', to: 'N07', distanceM: 450, baseSpeedKph: 50, congestion: 0.15, trafficLightDelayS:  5, blocked: false },
  { id: 'E15r', from: 'N07', to: 'N14', distanceM: 450, baseSpeedKph: 50, congestion: 0.15, trafficLightDelayS:  5, blocked: false },

  // Cross-connections (give the algorithm real route choices)
  { id: 'E16',  from: 'N04', to: 'N13', distanceM: 300, baseSpeedKph: 40, congestion: 0.40, trafficLightDelayS: 12, blocked: false },
  { id: 'E16r', from: 'N13', to: 'N04', distanceM: 300, baseSpeedKph: 40, congestion: 0.40, trafficLightDelayS: 12, blocked: false },
  { id: 'E17',  from: 'N03', to: 'N09', distanceM: 250, baseSpeedKph: 40, congestion: 0.35, trafficLightDelayS: 10, blocked: false },
  { id: 'E17r', from: 'N09', to: 'N03', distanceM: 250, baseSpeedKph: 40, congestion: 0.35, trafficLightDelayS: 10, blocked: false },
  { id: 'E18',  from: 'N05', to: 'N14', distanceM: 280, baseSpeedKph: 50, congestion: 0.20, trafficLightDelayS:  8, blocked: false },
  { id: 'E18r', from: 'N14', to: 'N05', distanceM: 280, baseSpeedKph: 50, congestion: 0.20, trafficLightDelayS:  8, blocked: false },
  { id: 'E19',  from: 'N06', to: 'N14', distanceM: 350, baseSpeedKph: 50, congestion: 0.20, trafficLightDelayS:  8, blocked: false },
  { id: 'E19r', from: 'N14', to: 'N06', distanceM: 350, baseSpeedKph: 50, congestion: 0.20, trafficLightDelayS:  8, blocked: false },
  { id: 'E20',  from: 'N15', to: 'N01', distanceM: 200, baseSpeedKph: 40, congestion: 0.50, trafficLightDelayS: 15, blocked: false },
  { id: 'E20r', from: 'N01', to: 'N15', distanceM: 200, baseSpeedKph: 40, congestion: 0.50, trafficLightDelayS: 15, blocked: false },
  { id: 'E21',  from: 'N15', to: 'N16', distanceM: 250, baseSpeedKph: 40, congestion: 0.45, trafficLightDelayS: 12, blocked: false },
  { id: 'E21r', from: 'N16', to: 'N15', distanceM: 250, baseSpeedKph: 40, congestion: 0.45, trafficLightDelayS: 12, blocked: false },
  { id: 'E22',  from: 'N16', to: 'N08', distanceM: 300, baseSpeedKph: 40, congestion: 0.30, trafficLightDelayS: 10, blocked: false },
  { id: 'E22r', from: 'N08', to: 'N16', distanceM: 300, baseSpeedKph: 40, congestion: 0.30, trafficLightDelayS: 10, blocked: false },
];
