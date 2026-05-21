import { Marker, Tooltip } from 'react-leaflet';
import { createTrafficLightIcon } from '@/src/components/map/leafletIcons';
import type { TrafficLightMarkerData } from '@/src/types/map';

interface TrafficLightLayerProps {
  lights: TrafficLightMarkerData[];
}

const PHASE_LABELS: Record<string, string> = {
  green:  'Green — Go',
  yellow: 'Yellow — Caution',
  red:    'Red — Stop',
};

export function TrafficLightLayer({ lights }: TrafficLightLayerProps) {
  return (
    <>
      {lights.map((light) => (
        <Marker
          key={light.id}
          position={[light.position.lat, light.position.lng]}
          icon={createTrafficLightIcon(light.phase)}
        >
          <Tooltip direction="top" offset={[0, -5]}>
            <span className="font-mono text-xs">
              Traffic Light {light.id} — {PHASE_LABELS[light.phase]}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
