import { Polyline, Tooltip } from 'react-leaflet';
import type { EmergencyRouteData } from '@/src/types/map';

interface EmergencyRouteLayerProps {
  route: EmergencyRouteData;
  /** When true, renders with an offset dash pattern so two overlapping routes
   *  are visually distinguishable (used in normal mode when seq≈par route). */
  secondary?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  '#3b82f6': '🔵 SEQ — Sequential Dispatcher route',
  '#06b6d4': '🟦 PAR — Parallel Dispatcher route',
};

export function EmergencyRouteLayer({ route, secondary = false }: EmergencyRouteLayerProps) {
  if (route.waypoints.length < 2) return null;

  const positions = route.waypoints.map(
    (p) => [p.lat, p.lng] as [number, number],
  );

  const color     = route.color ?? '#ef4444';
  // Thicker lines, distinct dash patterns to tell routes apart
  const dashArray = secondary ? '6 10' : (route.color ? '10 6' : '12 7');
  const weight    = secondary ? 4 : 6;
  const opacity   = secondary ? 0.72 : 0.92;
  const label     = ROLE_LABELS[color] ?? `🚨 Priority Route — Vehicle ${route.vehicleId}`;

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight,
        opacity,
        dashArray,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    >
      <Tooltip sticky>
        <span className="font-mono text-xs">{label}</span>
      </Tooltip>
    </Polyline>
  );
}
