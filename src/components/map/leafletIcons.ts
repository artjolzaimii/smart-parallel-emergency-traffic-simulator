import L from 'leaflet';
import type { VehicleType } from '@/src/types/vehicle';
import type { TrafficLightPhase } from '@/src/types/traffic';
import type { IncidentType, IncidentSeverity } from '@/src/types/incident';

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

const INCIDENT_SPECS: Record<IncidentType, { bg: string; border: string; text: string; glow: string }> = {
  accident:          { bg: '#ef4444', border: '#b91c1c', text: '!', glow: 'rgba(239,68,68,0.7)' },
  blocked:           { bg: '#f97316', border: '#c2410c', text: 'X', glow: 'rgba(249,115,22,0.7)' },
  'congestion-spike': { bg: '#eab308', border: '#a16207', text: '~', glow: 'rgba(234,179,8,0.7)' },
};

const INCIDENT_SIZES: Record<IncidentSeverity, number> = { low: 12, medium: 15, high: 19 };

export function createIncidentIcon(type: IncidentType, severity: IncidentSeverity): L.DivIcon {
  const s = INCIDENT_SPECS[type];
  const size = INCIDENT_SIZES[severity];
  const half = size / 2;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${s.bg};border:2px solid ${s.border};border-radius:3px;
      display:flex;align-items:center;justify-content:center;
      font-size:${size - 4}px;font-weight:900;color:white;
      box-shadow:0 0 8px ${s.glow};
    ">${s.text}</div>`,
    iconSize: [size, size],
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
