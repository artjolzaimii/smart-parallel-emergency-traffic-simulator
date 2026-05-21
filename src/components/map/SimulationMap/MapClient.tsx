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

export default function MapClient() {
  const { center, zoom } = TIRANA_MAP_CONFIG;
  const storeVehicles = useVehicleStore((s) => s.vehicles);
  const incidents = useEmergencyStore((s) => s.incidents);
  const liveTrafficLights = useEmergencyStore((s) => s.trafficLightMarkers);
  const liveEmergencyRoute = useEmergencyStore((s) => s.emergencyRoute);

  const vehicles = storeVehicles.length > 0 ? storeVehicles : MOCK_VEHICLES;
  const trafficLights = liveTrafficLights.length > 0 ? liveTrafficLights : MOCK_TRAFFIC_LIGHTS;
  const emergencyRoute = liveEmergencyRoute ?? MOCK_EMERGENCY_ROUTE;

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
        <EmergencyRouteLayer route={emergencyRoute} />
        <IncidentLayer incidents={incidents} />
        <TrafficLightLayer lights={trafficLights} />
        <VehicleLayer vehicles={vehicles} />
      </MapContainer>
    </div>
  );
}
