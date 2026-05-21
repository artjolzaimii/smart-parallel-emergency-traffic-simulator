'use client';

import { clsx } from 'clsx';
import { AlertTriangle, RefreshCw, Shield, Navigation } from 'lucide-react';
import { useEmergencyStore } from '@/src/store/emergencyStore';

function StatusPill({
  label,
  active,
  activeColor,
}: {
  label: string;
  active: boolean;
  activeColor: string;
}) {
  return (
    <span
      className={clsx(
        'rounded px-1.5 py-0.5 text-xs font-medium',
        active ? activeColor : 'bg-gray-800 text-gray-600',
      )}
    >
      {label}
    </span>
  );
}

function QualityBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const barColor =
    clamped >= 80 ? 'bg-green-500' :
    clamped >= 50 ? 'bg-yellow-500' :
                   'bg-red-500';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-gray-500">Route Quality</span>
        <span
          className={clsx(
            'font-mono text-xs font-bold',
            clamped >= 80 ? 'text-green-400' :
            clamped >= 50 ? 'text-yellow-400' :
                            'text-red-400',
          )}
        >
          {clamped.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function EmergencyStatusPanel() {
  const emergencyActive       = useEmergencyStore((s) => s.emergencyActive);
  const incidents             = useEmergencyStore((s) => s.incidents);
  const rerouteCount          = useEmergencyStore((s) => s.rerouteCount);
  const autoRerouteEnabled    = useEmergencyStore((s) => s.autoRerouteEnabled);
  const priorityEnabled       = useEmergencyStore((s) => s.emergencyPriorityEnabled);
  const routeQualityScore     = useEmergencyStore((s) => s.routeQualityScore);

  const activeIncidents = incidents.filter((i) => i.resolveAtTick > 0).length;

  return (
    <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Traffic Intelligence
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-gray-800 bg-gray-900 px-2 py-1.5">
          <div className="mb-0.5 flex items-center gap-1 text-xs text-gray-600">
            <AlertTriangle className="h-3 w-3" />
            Active Incidents
          </div>
          <p
            className={clsx(
              'font-mono text-sm font-bold',
              activeIncidents > 0 ? 'text-orange-400' : 'text-gray-600',
            )}
          >
            {activeIncidents}
          </p>
        </div>

        <div className="rounded border border-gray-800 bg-gray-900 px-2 py-1.5">
          <div className="mb-0.5 flex items-center gap-1 text-xs text-gray-600">
            <RefreshCw className="h-3 w-3" />
            Reroutes
          </div>
          <p
            className={clsx(
              'font-mono text-sm font-bold',
              rerouteCount > 0 ? 'text-cyan-400' : 'text-gray-600',
            )}
          >
            {rerouteCount}
          </p>
        </div>
      </div>

      {emergencyActive && <QualityBar score={routeQualityScore} />}

      <div className="flex items-center gap-2">
        <Navigation className="h-3 w-3 text-gray-600" />
        <span className="text-xs text-gray-600">Features</span>
        <div className="ml-auto flex gap-1.5">
          <StatusPill
            label="Auto-reroute"
            active={autoRerouteEnabled}
            activeColor="bg-cyan-950 text-cyan-400"
          />
          <StatusPill
            label="TL Priority"
            active={priorityEnabled}
            activeColor="bg-green-950 text-green-400"
          />
        </div>
      </div>
    </div>
  );
}
