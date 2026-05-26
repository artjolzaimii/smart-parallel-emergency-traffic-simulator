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

/** Check if two route waypoint arrays are roughly identical (share the same
 *  first and last waypoints). When true, we only render one line. */
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

export default function MapClient() {
  const { center, zoom } = TIRANA_MAP_CONFIG;
  const storeVehicles       = useVehicleStore((s) => s.vehicles);
  const incidents           = useEmergencyStore((s) => s.incidents);
  const liveTrafficLights   = useEmergencyStore((s) => s.trafficLightMarkers);
  const liveEmergencyRoute  = useEmergencyStore((s) => s.emergencyRoute);
  const compareRoute        = useEmergencyStore((s) => s.compareEmergencyRoute);
  const parallelAdvantageActive = useEmergencyStore((s) => s.parallelAdvantageActive);
  const normalDispatchComparison = useEmergencyStore((s) => s.normalDispatchComparison);

  const allVehicles = storeVehicles.length > 0 ? storeVehicles : MOCK_VEHICLES;
  const trafficLights = liveTrafficLights.length > 0 ? liveTrafficLights : MOCK_TRAFFIC_LIGHTS;
  const emergencyRoute = liveEmergencyRoute ?? MOCK_EMERGENCY_ROUTE;

  // In normal mode (not parallel advantage), only show the single ambulance (ev-001).
  // In parallel advantage scenario, show both SEQ (ev-001) and PAR (ev-002).
  const vehicles = parallelAdvantageActive
    ? allVehicles
    : allVehicles.filter((v) => v.id !== 'ev-002');

  // Determine if we should show a compare route (seq route) in normal mode.
  // Only show if the routes are meaningfully different.
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

        {/* Primary route — SEQ in compare/advantage mode, parallel route in normal mode */}
        <EmergencyRouteLayer route={emergencyRoute} />

        {/* PAR route (compare/advantage scenario) or SEQ route (normal mode when different) */}
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
    </div>
  );
}
