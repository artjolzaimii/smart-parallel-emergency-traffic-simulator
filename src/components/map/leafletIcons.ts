import L from 'leaflet';
import type { VehicleType } from '@/src/types/vehicle';
import type { TrafficLightPhase } from '@/src/types/traffic';
import type { IncidentType, IncidentSeverity } from '@/src/types/incident';

// ─── Vehicle icons ────────────────────────────────────────────────────────────

function ambulanceSvg(bodyColor = '#ef4444'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
    <rect x="1" y="5" width="22" height="13" rx="3" fill="${bodyColor}" stroke="#fff" stroke-width="1.5"/>
    <rect x="9" y="8" width="6" height="2" fill="#fff"/>
    <rect x="11" y="6" width="2" height="6" fill="#fff"/>
    <rect x="2" y="16" width="4" height="3" rx="1" fill="#1f2937"/>
    <rect x="18" y="16" width="4" height="3" rx="1" fill="#1f2937"/>
    <circle cx="4" cy="18.5" r="1.5" fill="#374151"/>
    <circle cx="20" cy="18.5" r="1.5" fill="#374151"/>
  </svg>`;
}

function carSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 14" width="20" height="14">
    <rect x="1" y="4" width="18" height="8" rx="2" fill="${color}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
    <rect x="4" y="2" width="12" height="5" rx="1.5" fill="${color}" opacity="0.85"/>
    <rect x="5" y="2.5" width="10" height="3.5" rx="1" fill="rgba(200,240,255,0.7)"/>
    <circle cx="4" cy="12" r="2" fill="#111" stroke="#555" stroke-width="0.5"/>
    <circle cx="16" cy="12" r="2" fill="#111" stroke="#555" stroke-width="0.5"/>
  </svg>`;
}

function truckSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 16" width="26" height="16">
    <rect x="1" y="3" width="20" height="11" rx="1.5" fill="${color}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
    <rect x="21" y="6" width="4" height="8" rx="1" fill="${color}" opacity="0.9"/>
    <rect x="21.5" y="6.5" width="3" height="4" rx="0.5" fill="rgba(200,240,255,0.6)"/>
    <circle cx="5" cy="14" r="2" fill="#111" stroke="#555" stroke-width="0.5"/>
    <circle cx="17" cy="14" r="2" fill="#111" stroke="#555" stroke-width="0.5"/>
  </svg>`;
}

function motorcycleSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 14" width="18" height="14">
    <ellipse cx="9" cy="7" rx="4" ry="3.5" fill="${color}" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
    <rect x="3" y="5.5" width="12" height="3" rx="1.5" fill="${color}" opacity="0.7"/>
    <circle cx="3" cy="11" r="2.5" fill="#111" stroke="#555" stroke-width="0.5"/>
    <circle cx="15" cy="11" r="2.5" fill="#111" stroke="#555" stroke-width="0.5"/>
  </svg>`;
}

/**
 * @param type                Vehicle type
 * @param vehicleId           Optional id — used to pick per-role color in Parallel Advantage mode.
 * @param parallelAdvantage   True when the Parallel Advantage Scenario is active.
 *                            Only then does ev-001 show as blue (SEQ) and ev-002 as cyan (PAR).
 *                            In normal mode, ev-001 shows as the standard red ambulance.
 */
export function createVehicleIcon(type: VehicleType, vehicleId?: string, parallelAdvantage = false): L.DivIcon {
  if (type === 'emergency') {
    // Parallel Advantage Scenario role colours
    const bodyColor =
      parallelAdvantage && vehicleId === 'ev-002' ? '#06b6d4'   // PAR → cyan
      : parallelAdvantage && vehicleId === 'ev-001' ? '#3b82f6'  // SEQ → blue
      : '#ef4444';                                                // normal → red
    const glowColor =
      parallelAdvantage && vehicleId === 'ev-002' ? 'rgba(6,182,212,0.9)'
      : parallelAdvantage && vehicleId === 'ev-001' ? 'rgba(59,130,246,0.9)'
      : 'rgba(239,68,68,0.9)';
    return L.divIcon({
      className: '',
      html: `<div style="filter:drop-shadow(0 0 12px ${glowColor});animation:marker-pulse 1.2s ease-in-out infinite">${ambulanceSvg(bodyColor)}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }

  const svgMap: Record<string, { svg: string; w: number; h: number }> = {
    car:        { svg: carSvg('#06b6d4'),        w: 20, h: 14 },
    truck:      { svg: truckSvg('#818cf8'),      w: 26, h: 16 },
    motorcycle: { svg: motorcycleSvg('#34d399'), w: 18, h: 14 },
  };

  const spec = svgMap[type] ?? svgMap['car'];
  return L.divIcon({
    className: '',
    html: `<div style="filter:drop-shadow(0 0 3px rgba(0,0,0,0.5))">${spec.svg}</div>`,
    iconSize: [spec.w, spec.h],
    iconAnchor: [spec.w / 2, spec.h / 2],
  });
}

// ─── Traffic light icon ───────────────────────────────────────────────────────

const TL_COLORS: Record<TrafficLightPhase, { bg: string; glow: string }> = {
  green:  { bg: '#22c55e', glow: 'rgba(34,197,94,0.85)' },
  yellow: { bg: '#eab308', glow: 'rgba(234,179,8,0.85)' },
  red:    { bg: '#ef4444', glow: 'rgba(239,68,68,0.85)' },
};

export function createTrafficLightIcon(phase: TrafficLightPhase): L.DivIcon {
  const c = TL_COLORS[phase];
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
      <div style="width:6px;height:6px;border-radius:50%;background:${phase === 'red' ? c.bg : '#374151'};box-shadow:${phase === 'red' ? `0 0 5px ${c.glow}` : 'none'}"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${phase === 'yellow' ? c.bg : '#374151'};box-shadow:${phase === 'yellow' ? `0 0 5px ${c.glow}` : 'none'}"></div>
      <div style="width:6px;height:6px;border-radius:50%;background:${phase === 'green' ? c.bg : '#374151'};box-shadow:${phase === 'green' ? `0 0 5px ${c.glow}` : 'none'}"></div>
    </div>`;
  return L.divIcon({
    className: '',
    html: `<div style="background:#1f2937;border:1px solid #4b5563;border-radius:3px;padding:2px 3px;width:12px">${html}</div>`,
    iconSize: [12, 26],
    iconAnchor: [6, 13],
  });
}

// ─── Incident icon ────────────────────────────────────────────────────────────

const INCIDENT_SPECS: Record<IncidentType, { bg: string; border: string; text: string; glow: string }> = {
  accident:           { bg: '#ef4444', border: '#b91c1c', text: '!', glow: 'rgba(239,68,68,0.7)' },
  blocked:            { bg: '#f97316', border: '#c2410c', text: '✕', glow: 'rgba(249,115,22,0.7)' },
  'congestion-spike': { bg: '#eab308', border: '#a16207', text: '~', glow: 'rgba(234,179,8,0.7)' },
};

const INCIDENT_SIZES: Record<IncidentSeverity, number> = { low: 13, medium: 16, high: 20 };

export function createIncidentIcon(type: IncidentType, severity: IncidentSeverity): L.DivIcon {
  const s = INCIDENT_SPECS[type];
  const size = INCIDENT_SIZES[severity];
  const half = size / 2;
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${s.bg};border:2px solid ${s.border};border-radius:4px;
      display:flex;align-items:center;justify-content:center;
      font-size:${size - 5}px;font-weight:900;color:white;
      box-shadow:0 0 8px ${s.glow};
    ">${s.text}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}
