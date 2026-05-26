import { Marker, Tooltip } from 'react-leaflet';
import { createVehicleIcon } from '@/src/components/map/leafletIcons';
import type { VehicleMarkerData } from '@/src/types/map';

interface VehicleLayerProps {
  vehicles: VehicleMarkerData[];
  /** When true, SEQ/PAR role colors are applied (blue for ev-001, cyan for ev-002).
   *  In normal mode this is false so the ambulance shows as the standard red. */
  parallelAdvantage?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  car:        'Car',
  truck:      'Truck',
  motorcycle: 'Motorcycle',
  emergency:  'Emergency',
};

export function VehicleLayer({ vehicles, parallelAdvantage = false }: VehicleLayerProps) {
  return (
    <>
      {vehicles.map((vehicle) => (
        <Marker
          key={vehicle.id}
          position={[vehicle.position.lat, vehicle.position.lng]}
          icon={createVehicleIcon(vehicle.type, vehicle.id, parallelAdvantage)}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <span className="font-mono text-xs">
              {vehicle.label ?? `${TYPE_LABELS[vehicle.type]} ${vehicle.id}`}
              {vehicle.isEmergency && ' 🚨'}
            </span>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
