import { MapContainer, TileLayer } from 'react-leaflet';
import { VehicleLayer } from '@/src/components/map/VehicleMarker';
import { TrafficLightLayer } from '@/src/components/map/TrafficLightOverlay';
import { EmergencyRouteLayer } from '@/src/components/map/RoutePolyline';
import { CongestionLayer } from '@/src/components/map/CongestionHeatmap';
import {
  TIRANA_MAP_CONFIG,
  MOCK_VEHICLES,
  MOCK_TRAFFIC_LIGHTS,
  MOCK_EMERGENCY_ROUTE,
  MOCK_CONGESTION_SEGMENTS,
} from '@/data/scenarios/tiranaMockData';

// CartoDB Dark Matter — ideal tile layer for dark smart-city dashboards
const TILE_URL =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function MapClient() {
  const { center, zoom } = TIRANA_MAP_CONFIG;

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

        {/* Congestion road segments — rendered first so markers appear above */}
        <CongestionLayer segments={MOCK_CONGESTION_SEGMENTS} />

        {/* Emergency priority route */}
        <EmergencyRouteLayer route={MOCK_EMERGENCY_ROUTE} />

        {/* Traffic light markers */}
        <TrafficLightLayer lights={MOCK_TRAFFIC_LIGHTS} />

        {/* Vehicle markers — top layer */}
        <VehicleLayer vehicles={MOCK_VEHICLES} />
      </MapContainer>
    </div>
  );
}
