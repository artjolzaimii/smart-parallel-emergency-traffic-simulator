'use client';

import { clsx } from 'clsx';
import { Siren, Navigation, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useMetricsStore } from '@/src/store/metricsStore';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import { useSimulationStore } from '@/src/store/simulationStore';
import type { EmergencyDispatchStatus } from '@/src/types/emergency';

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900 px-2 py-1.5">
      <p className="mb-0.5 text-xs text-gray-600">{label}</p>
      <p className={clsx('font-mono text-sm font-bold', color)}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={clsx('font-mono text-xs', color)}>{value}</span>
    </div>
  );
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDist(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`;
}

function StatusBadge({ status }: { status: EmergencyDispatchStatus }) {
  const configs: Record<EmergencyDispatchStatus, { label: string; className: string; Icon: React.ElementType }> = {
    idle:      { label: 'Idle',       className: 'bg-gray-800 text-gray-500',   Icon: Navigation },
    routing:   { label: 'Routing…',   className: 'bg-blue-950 text-blue-400',   Icon: Loader2 },
    active:    { label: 'En Route',   className: 'bg-red-950 text-red-400',     Icon: Siren },
    rerouting: { label: 'Rerouting…', className: 'bg-orange-950 text-orange-400', Icon: Loader2 },
    completed: { label: 'Arrived',    className: 'bg-green-950 text-green-400', Icon: CheckCircle2 },
  };
  const { label, className, Icon } = configs[status];
  const spinning = status === 'routing' || status === 'rerouting';
  return (
    <span className={clsx('flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold', className)}>
      <Icon className={clsx('h-3 w-3', spinning && 'animate-spin')} />
      {label}
    </span>
  );
}

export function EmergencyMetrics() {
  const routing      = useMetricsStore((s) => s.routing);
  const dispatchState = useEmergencyStore((s) => s.dispatchState);
  const currentMode  = useSimulationStore((s) => s.config.mode);

  if (!routing && !dispatchState) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Siren className="h-4 w-4 text-gray-600" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Emergency Routing
          </span>
        </div>
        <p className="py-2 text-center text-xs text-gray-700">No emergency active</p>
      </div>
    );
  }

  const isCompleted = dispatchState?.status === 'completed';
  const isActive    = dispatchState?.status === 'active' || dispatchState?.status === 'rerouting';
  const borderColor = isCompleted ? 'border-green-900' : 'border-red-900';

  return (
    <div className={clsx('space-y-3 rounded-lg border bg-gray-950 p-3', borderColor)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Siren className={clsx('h-4 w-4', isCompleted ? 'text-green-400' : 'animate-pulse text-red-400')} />
        <span className={clsx('text-xs font-semibold uppercase tracking-widest', isCompleted ? 'text-green-500' : 'text-red-500')}>
          {isCompleted ? 'Mission Complete' : 'Emergency Dispatch'}
        </span>
        {dispatchState && (
          <span className="ml-auto">
            <StatusBadge status={dispatchState.status} />
          </span>
        )}
      </div>

      {/* Live ETA + Distance while moving */}
      {(isActive || isCompleted) && dispatchState && (
        <div className="grid grid-cols-2 gap-2">
          <StatBox
            label="ETA Remaining"
            value={isCompleted ? '0s' : formatEta(dispatchState.etaRemainingS)}
            color={isCompleted ? 'text-green-400' : 'text-red-400'}
          />
          <StatBox
            label="Distance Left"
            value={isCompleted ? '0 m' : formatDist(dispatchState.distanceRemainingM)}
            color="text-orange-400"
          />
          <StatBox
            label="Reroutes"
            value={String(dispatchState.reroutes)}
            color={dispatchState.reroutes > 0 ? 'text-yellow-400' : 'text-gray-600'}
          />
          {isCompleted && dispatchState.totalResponseTimeS !== null ? (
            <StatBox
              label="Total Time"
              value={formatEta(dispatchState.totalResponseTimeS)}
              color="text-green-400"
            />
          ) : (
            <StatBox
              label="Roads Eval"
              value={routing ? String(routing.roadsEvaluated) : '—'}
              color="text-yellow-400"
            />
          )}
        </div>
      )}

      {/* Routing result stats when just routed but not yet moving */}
      {routing && !isActive && !isCompleted && (
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="ETA"        value={`~${Math.ceil(routing.estimatedTravelTimeS / 60)}m`} color="text-red-400" />
          <StatBox label="Distance"   value={`${(routing.totalDistanceM / 1000).toFixed(2)} km`} color="text-orange-400" />
          <StatBox label="Roads Eval" value={String(routing.roadsEvaluated)}                      color="text-yellow-400" />
          <StatBox label="Route Cost" value={`${routing.totalCostS.toFixed(0)}s`}                color="text-cyan-400" />
        </div>
      )}

      {/* Detail rows */}
      <div className="space-y-1.5 border-t border-gray-800 pt-2">
        {dispatchState && (
          <InfoRow
            label="Route compute"
            value={`${dispatchState.computeMs.toFixed(1)} ms`}
            color="text-gray-400"
          />
        )}
        {dispatchState && (
          <InfoRow
            label="Strategy"
            value={dispatchState.selectedStrategy.replace(/-/g, ' ')}
            color="text-purple-400"
          />
        )}
        {dispatchState && (
          <InfoRow
            label="Workers"
            value={dispatchState.workersUsed > 0 ? `${dispatchState.workersUsed} parallel` : 'sequential'}
            color={dispatchState.workersUsed > 0 ? 'text-cyan-500' : 'text-gray-500'}
          />
        )}
        {dispatchState?.routeBlockedDetected && (
          <div className="flex items-center gap-1.5 rounded bg-orange-950/50 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-orange-400" />
            <span className="text-xs text-orange-400">Blocked route detected — rerouted</span>
          </div>
        )}
        {currentMode === 'parallel' && !dispatchState?.routeBlockedDetected && (
          <p className="text-xs text-gray-700">
            Parallel mode evaluates 4 strategies simultaneously. See Benchmark for measured speedup.
          </p>
        )}
      </div>
    </div>
  );
}
