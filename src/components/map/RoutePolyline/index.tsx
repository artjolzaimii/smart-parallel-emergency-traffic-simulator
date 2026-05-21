import { Polyline, Tooltip } from 'react-leaflet';
import type { EmergencyRouteData } from '@/src/types/map';

interface EmergencyRouteLayerProps {
  route: EmergencyRouteData;
}

export function EmergencyRouteLayer({ route }: EmergencyRouteLayerProps) {
  const positions = route.waypoints.map(
    (p) => [p.lat, p.lng] as [number, number],
  );

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#ef4444',
        weight: 4,
        opacity: 0.88,
        dashArray: '10 6',
        lineCap: 'round',
        lineJoin: 'round',
      }}
    >
      <Tooltip sticky>
        <span className="font-mono text-xs">
          🚨 Priority Route — Vehicle {route.vehicleId}
        </span>
      </Tooltip>
    </Polyline>
  );
}
