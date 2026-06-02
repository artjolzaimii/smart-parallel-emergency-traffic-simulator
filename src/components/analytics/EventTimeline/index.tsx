'use client';

import { clsx } from 'clsx';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import type { SimulationEventType } from '@/src/types/events';

// ─── Icon & color per event type ─────────────────────────────────────────────

const EVENT_CONFIG: Record<SimulationEventType, { icon: string; color: string; bg: string }> = {
  emergency_triggered: { icon: '🚨', color: 'text-red-400',    bg: 'bg-red-950/30' },
  seq_route_computed:  { icon: '🔵', color: 'text-blue-400',   bg: 'bg-blue-950/20' },
  par_route_computed:  { icon: '🟦', color: 'text-cyan-400',   bg: 'bg-cyan-950/20' },
  dispatch_started:    { icon: '▶',  color: 'text-green-400',  bg: 'bg-green-950/20' },
  incident_created:    { icon: '⚠',  color: 'text-orange-400', bg: 'bg-orange-950/20' },
  route_blocked:       { icon: '🛑', color: 'text-red-400',    bg: 'bg-red-950/30' },
  reroute_started:     { icon: '↩',  color: 'text-yellow-400', bg: 'bg-yellow-950/20' },
  reroute_completed:   { icon: '✓',  color: 'text-green-400',  bg: 'bg-green-950/20' },
  arrived:             { icon: '🏁', color: 'text-green-400',  bg: 'bg-green-950/30' },
  demo_started:        { icon: '⚡', color: 'text-cyan-400',   bg: 'bg-cyan-950/20' },
  demo_complete:       { icon: '🏆', color: 'text-yellow-400', bg: 'bg-yellow-950/20' },
};

export function EventTimeline() {
  const events = useEmergencyStore((s) => s.events);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
        <p className="text-center text-xs text-gray-700">No events yet — start the simulation</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((ev) => {
        const cfg = EVENT_CONFIG[ev.type] ?? { icon: '•', color: 'text-gray-400', bg: '' };
        return (
          <div
            key={ev.id}
            className={clsx(
              'flex items-start gap-2 rounded border border-gray-800 px-2 py-1.5',
              cfg.bg,
            )}
          >
            <span className="mt-px shrink-0 text-xs">{cfg.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={clsx('text-xs font-semibold leading-snug', cfg.color)}>
                {ev.label}
              </p>
              {ev.detail && (
                <p className="truncate text-xs text-gray-600">{ev.detail}</p>
              )}
            </div>
            <span className="shrink-0 font-mono text-xs text-gray-700">t{ev.tick}</span>
          </div>
        );
      })}
    </div>
  );
}
