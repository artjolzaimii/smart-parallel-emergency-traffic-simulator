import L from 'leaflet';
import type { VehicleType } from '@/src/types/vehicle';
import type { TrafficLightPhase } from '@/src/types/traffic';

interface ColorSpec {
  bg: string;
  border: string;
  glow: string;
  size: number;
}

const VEHICLE_SPECS: Record<VehicleType, ColorSpec> = {
  car:        { bg: '#06b6d4', border: '#0e7490', glow: 'rgba(6,182,212,0.55)',   size: 10 },
  truck:      { bg: '#818cf8', border: '#4338ca', glow: 'rgba(129,140,248,0.55)', size: 12 },
  motorcycle: { bg: '#34d399', border: '#047857', glow: 'rgba(52,211,153,0.55)',  size: 9  },
  emergency:  { bg: '#ef4444', border: '#b91c1c', glow: 'rgba(239,68,68,0.80)',   size: 16 },
};

const TRAFFIC_LIGHT_SPECS: Record<TrafficLightPhase, { bg: string; glow: string }> = {
  green:  { bg: '#22c55e', glow: 'rgba(34,197,94,0.75)' },
  yellow: { bg: '#eab308', glow: 'rgba(234,179,8,0.75)' },
  red:    { bg: '#ef4444', glow: 'rgba(239,68,68,0.75)' },
};

export function createVehicleIcon(type: VehicleType): L.DivIcon {
  const s = VEHICLE_SPECS[type];
  const half = s.size / 2;
  const isEmergency = type === 'emergency';

  return L.divIcon({
    className: '',
    html: `<div style="
      width:${s.size}px;
      height:${s.size}px;
      background:${s.bg};
      border:2px solid ${s.border};
      border-radius:50%;
      box-shadow:0 0 ${isEmergency ? 14 : 6}px ${s.glow};
      ${isEmergency ? 'animation:marker-pulse 1.4s ease-in-out infinite;' : ''}
    "></div>`,
    iconSize: [s.size, s.size],
    iconAnchor: [half, half],
  });
}

export function createTrafficLightIcon(phase: TrafficLightPhase): L.DivIcon {
  const s = TRAFFIC_LIGHT_SPECS[phase];
  return L.divIcon({
    className: '',
    html: `<div style="
      width:9px;
      height:9px;
      background:${s.bg};
      border:1.5px solid rgba(255,255,255,0.25);
      border-radius:50%;
      box-shadow:0 0 8px ${s.glow};
    "></div>`,
    iconSize: [9, 9],
    iconAnchor: [4, 4],
  });
}
