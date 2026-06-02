import { MapContainer, TileLayer } from 'react-leaflet';
import { VehicleLayer } from '@/src/components/map/VehicleMarker';
import { TrafficLightLayer } from '@/src/components/map/TrafficLightOverlay';
import { EmergencyRouteLayer } from '@/src/components/map/RoutePolyline';
import { CongestionLayer } from '@/src/components/map/CongestionHeatmap';
import { IncidentLayer } from '@/src/components/map/IncidentLayer';
import { useVehicleStore } from '@/src/store/vehicleStore';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import {
  TIRANA_MAP_CONFIG,
  MOCK_VEHICLES,
  MOCK_TRAFFIC_LIGHTS,
  MOCK_EMERGENCY_ROUTE,
  MOCK_CONGESTION_SEGMENTS,
} from '@/data/scenarios/tiranaMockData';

const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Check if two route waypoint arrays are roughly identical. When true we only render one line. */
function routesOverlap(
  r1: { lat: number; lng: number }[],
  r2: { lat: number; lng: number }[],
): boolean {
  if (r1.length === 0 || r2.length === 0) return false;
  const a0 = r1[0]; const a1 = r1[r1.length - 1];
  const b0 = r2[0]; const b1 = r2[r2.length - 1];
  const dist = (p: { lat: number; lng: number }, q: { lat: number; lng: number }) =>
    Math.abs(p.lat - q.lat) + Math.abs(p.lng - q.lng);
  return dist(a0, b0) < 0.001 && dist(a1, b1) < 0.001;
}

// ─── Map legend overlay ───────────────────────────────────────────────────────

interface LegendRowProps {
  color: string;
  label: string;
  dashed?: boolean;
  isSquare?: boolean;
}

function LegendRow({ color, label, dashed, isSquare }: LegendRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {isSquare ? (
        <div style={{
          width: 10, height: 10,
          background: color,
          borderRadius: 2,
          flexShrink: 0,
        }} />
      ) : (
        <div style={{
          width: 18, height: 3,
          background: dashed ? 'transparent' : color,
          borderBottom: dashed ? `3px dashed ${color}` : 'none',
          flexShrink: 0,
        }} />
      )}
      <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function MapLegend({ parallelAdvantage }: { parallelAdvantage: boolean }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 28,
      left: 8,
      zIndex: 2000,
      background: 'rgba(17,24,39,0.88)',
      border: '1px solid #374151',
      borderRadius: 8,
      padding: '8px 10px',
      backdropFilter: 'blur(4px)',
      pointerEvents: 'none',
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 6 }}>
        Legend
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <LegendRow color="#3b82f6" label={parallelAdvantage ? 'SEQ route' : 'Sequential route'} />
        <LegendRow color="#06b6d4" label={parallelAdvantage ? 'PAR route' : 'Parallel route'} dashed />
        <LegendRow color="#ef4444" label="Incident" isSquare />
        <LegendRow color="#ef4444" label="Ambulance (pulsing)" isSquare />
      </div>
    </div>
  );
}

// ─── Map client ───────────────────────────────────────────────────────────────

export default function MapClient() {
  const { center, zoom } = TIRANA_MAP_CONFIG;
  const storeVehicles           = useVehicleStore((s) => s.vehicles);
  const incidents               = useEmergencyStore((s) => s.incidents);
  const liveTrafficLights       = useEmergencyStore((s) => s.trafficLightMarkers);
  const liveEmergencyRoute      = useEmergencyStore((s) => s.emergencyRoute);
  const compareRoute            = useEmergencyStore((s) => s.compareEmergencyRoute);
  const parallelAdvantageActive = useEmergencyStore((s) => s.parallelAdvantageActive);
  const normalDispatchComparison = useEmergencyStore((s) => s.normalDispatchComparison);

  const allVehicles   = storeVehicles.length > 0 ? storeVehicles : MOCK_VEHICLES;
  const trafficLights = liveTrafficLights.length > 0 ? liveTrafficLights : MOCK_TRAFFIC_LIGHTS;
  const emergencyRoute = liveEmergencyRoute ?? MOCK_EMERGENCY_ROUTE;

  // In normal mode only show the single ambulance (ev-001).
  // In parallel advantage scenario show both SEQ (ev-001) and PAR (ev-002).
  const vehicles = parallelAdvantageActive
    ? allVehicles
    : allVehicles.filter((v) => v.id !== 'ev-002');

  const showNormalSeqRoute =
    !parallelAdvantageActive &&
    normalDispatchComparison !== null &&
    compareRoute &&
    compareRoute.waypoints.length >= 2 &&
    !routesOverlap(emergencyRoute.waypoints, compareRoute.waypoints);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url={TILE_URL}
          attribution={TILE_ATTRIBUTION}
          maxZoom={20}
          subdomains="abcd"
        />

        <CongestionLayer segments={MOCK_CONGESTION_SEGMENTS} />

        {/* Primary route */}
        <EmergencyRouteLayer route={emergencyRoute} />

        {/* PAR route (advantage scenario) or SEQ route (normal mode when different) */}
        {parallelAdvantageActive && compareRoute && compareRoute.waypoints.length >= 2 && (
          <EmergencyRouteLayer route={compareRoute} />
        )}
        {showNormalSeqRoute && compareRoute && (
          <EmergencyRouteLayer route={compareRoute} secondary />
        )}

        <IncidentLayer incidents={incidents} />
        <TrafficLightLayer lights={trafficLights} />
        <VehicleLayer vehicles={vehicles} parallelAdvantage={parallelAdvantageActive} />
      </MapContainer>

      {/* Legend overlay — rendered outside MapContainer so z-index works reliably */}
      <MapLegend parallelAdvantage={parallelAdvantageActive} />
    </div>
  );
}
