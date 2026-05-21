import { Marker, Tooltip } from 'react-leaflet';
import { createIncidentIcon } from '@/src/components/map/leafletIcons';
import type { Incident } from '@/src/types/incident';

const INCIDENT_LABELS: Record<Incident['type'], string> = {
  accident:          'Accident',
  blocked:           'Road Blocked',
  'congestion-spike': 'Congestion Spike',
};

export function IncidentLayer({ incidents }: { incidents: Incident[] }) {
  return (
    <>
      {incidents.map((incident) => (
        <Marker
          key={incident.id}
          position={[incident.position.lat, incident.position.lng]}
          icon={createIncidentIcon(incident.type, incident.severity)}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <span className="font-mono text-xs">
              {INCIDENT_LABELS[incident.type]} · {incident.severity}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
