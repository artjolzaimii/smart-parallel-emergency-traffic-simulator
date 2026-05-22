import type {
  VehicleMarkerData,
  TrafficLightMarkerData,
  CongestionSegmentData,
  EmergencyRouteData,
  MapViewConfig,
} from '../../src/types/map';

export const TIRANA_MAP_CONFIG: MapViewConfig = {
  // Midpoint between Grand Park dispatch origin (S) and QSUT Hospital (N).
  center: { lat: 41.3238, lng: 19.8145 },
  zoom: 14,
};

export const MOCK_VEHICLES: VehicleMarkerData[] = [
  { id: 'v-001', type: 'car',        isEmergency: false, position: { lat: 41.3291, lng: 19.8201 } },
  { id: 'v-002', type: 'car',        isEmergency: false, position: { lat: 41.3265, lng: 19.8155 } },
  { id: 'v-003', type: 'truck',      isEmergency: false, position: { lat: 41.3248, lng: 19.8220 } },
  { id: 'v-004', type: 'car',        isEmergency: false, position: { lat: 41.3315, lng: 19.8168 } },
  { id: 'v-005', type: 'motorcycle', isEmergency: false, position: { lat: 41.3258, lng: 19.8245 } },
  { id: 'v-006', type: 'car',        isEmergency: false, position: { lat: 41.3232, lng: 19.8170 } },
  { id: 'v-007', type: 'car',        isEmergency: false, position: { lat: 41.3308, lng: 19.8235 } },
  { id: 'v-008', type: 'truck',      isEmergency: false, position: { lat: 41.3272, lng: 19.8142 } },
  { id: 'v-009', type: 'car',        isEmergency: false, position: { lat: 41.3240, lng: 19.8195 } },
  { id: 'v-010', type: 'car',        isEmergency: false, position: { lat: 41.3285, lng: 19.8275 } },
  {
    id: 'ev-001',
    type: 'emergency',
    isEmergency: true,
    position: { lat: 41.310370, lng: 19.808463 }, // Grand Park / Artificial Lake
    label: 'AMB-01',
  },
];

export const MOCK_TRAFFIC_LIGHTS: TrafficLightMarkerData[] = [
  { id: 'tl-001', position: { lat: 41.3285, lng: 19.8193 }, phase: 'green' },
  { id: 'tl-002', position: { lat: 41.3265, lng: 19.8180 }, phase: 'red' },
  { id: 'tl-003', position: { lat: 41.3300, lng: 19.8215 }, phase: 'yellow' },
  { id: 'tl-004', position: { lat: 41.3248, lng: 19.8208 }, phase: 'green' },
  { id: 'tl-005', position: { lat: 41.3318, lng: 19.8182 }, phase: 'red' },
  { id: 'tl-006', position: { lat: 41.3258, lng: 19.8245 }, phase: 'green' },
];

// AMB-01 priority route: Grand Park / Artificial Lake (S) → QSUT Hospital (N)
// Placeholder shown before WebSocket delivers the first live snapshot.
export const MOCK_EMERGENCY_ROUTE: EmergencyRouteData = {
  id: 'route-001',
  vehicleId: 'ev-001',
  waypoints: [
    { lat: 41.310370, lng: 19.808463 }, // Grand Park dispatch origin
    { lat: 41.3135,   lng: 19.8093 },
    { lat: 41.3175,   lng: 19.8112 },
    { lat: 41.3215,   lng: 19.8138 },
    { lat: 41.3258,   lng: 19.8160 },
    { lat: 41.3295,   lng: 19.8180 },
    { lat: 41.3330,   lng: 19.8198 },
    { lat: 41.3372,   lng: 19.8207 }, // QSUT Hospital
  ],
};

export const MOCK_CONGESTION_SEGMENTS: CongestionSegmentData[] = [
  {
    id: 'seg-001',
    label: 'Rruga e Kavajës',
    density: 0.85,
    points: [
      { lat: 41.3280, lng: 19.8060 },
      { lat: 41.3272, lng: 19.8108 },
      { lat: 41.3268, lng: 19.8150 },
    ],
  },
  {
    id: 'seg-002',
    label: 'Bulevardi Dëshmorët e Kombit',
    density: 0.52,
    points: [
      { lat: 41.3230, lng: 19.8186 },
      { lat: 41.3252, lng: 19.8189 },
      { lat: 41.3273, lng: 19.8190 },
    ],
  },
  {
    id: 'seg-003',
    label: 'Rruga Ismail Qemali',
    density: 0.15,
    points: [
      { lat: 41.3198, lng: 19.8142 },
      { lat: 41.3212, lng: 19.8162 },
      { lat: 41.3228, lng: 19.8178 },
    ],
  },
  {
    id: 'seg-004',
    label: 'Rruga Myslym Shyri',
    density: 0.73,
    points: [
      { lat: 41.3215, lng: 19.8192 },
      { lat: 41.3228, lng: 19.8203 },
      { lat: 41.3240, lng: 19.8218 },
    ],
  },
  {
    id: 'seg-005',
    label: 'Rruga Tefta Tashko-Koço',
    density: 0.44,
    points: [
      { lat: 41.3258, lng: 19.8278 },
      { lat: 41.3264, lng: 19.8295 },
      { lat: 41.3270, lng: 19.8312 },
    ],
  },
];
