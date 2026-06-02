'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Info, FlaskConical, Siren, AlertTriangle, RefreshCw, Navigation, Shield } from 'lucide-react';
import { ComparePanel } from '@/src/components/analytics/ComparePanel';
import { NormalDispatchPanel } from '@/src/components/analytics/NormalDispatchPanel';
import { BenchmarkModal } from '@/src/components/ui/BenchmarkModal';
import { useMetricsStore } from '@/src/store/metricsStore';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import { useSimulationStore } from '@/src/store/simulationStore';
import type { EmergencyDispatchStatus } from '@/src/types/emergency';

// ─── Compact Mission Status ───────────────────────────────────────────────────

function fmtEta(s: number): string {
  if (s <= 0) return '—';
  const m = Math.floor(s / 60); const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

const STATUS_CFG: Record<EmergencyDispatchStatus, { label: string; cls: string }> = {
  idle:      { label: 'Idle',        cls: 'bg-gray-800 text-gray-500' },
  routing:   { label: 'Routing…',    cls: 'bg-blue-950 text-blue-400' },
  active:    { label: 'En Route',    cls: 'bg-red-950 text-red-400' },
  rerouting: { label: 'Rerouting…',  cls: 'bg-orange-950 text-orange-400' },
  completed: { label: 'Arrived ✓',   cls: 'bg-green-950 text-green-400' },
};

function MetricPair({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={clsx('font-mono text-xs font-semibold', color)}>{value}</span>
    </div>
  );
}

function MissionStatus() {
  const routing       = useMetricsStore((s) => s.routing);
  const dispatchState = useEmergencyStore((s) => s.dispatchState);

  if (!routing && !dispatchState) {
    return (
      <div className="flex items-center gap-2 rounded border border-gray-800 bg-gray-950 px-2.5 py-2">
        <Siren className="h-3.5 w-3.5 text-gray-600" />
        <span className="text-xs text-gray-600">No emergency active</span>
        <span className="ml-auto text-xs text-gray-700">Trigger one →</span>
      </div>
    );
  }

  const isCompleted = dispatchState?.status === 'completed';
  const isActive    = dispatchState?.status === 'active' || dispatchState?.status === 'rerouting';
  const cfg         = STATUS_CFG[dispatchState?.status ?? 'idle'];

  return (
    <div className={clsx('space-y-1.5 rounded border bg-gray-950 p-2.5',
      isCompleted ? 'border-green-900' : 'border-red-900')}>
      {/* Header row */}
      <div className="flex items-center gap-1.5">
        <Siren className={clsx('h-3.5 w-3.5', isCompleted ? 'text-green-400' : 'animate-pulse text-red-400')} />
        <span className={clsx('text-xs font-semibold uppercase tracking-wider',
          isCompleted ? 'text-green-500' : 'text-red-500')}>
          {isCompleted ? 'Mission Complete' : 'Emergency Dispatch'}
        </span>
        <span className={clsx('ml-auto rounded px-1.5 py-0.5 text-xs font-semibold', cfg.cls)}>
          {cfg.label}
        </span>
      </div>

      {/* Key metrics as inline rows */}
      {(isActive || isCompleted) && dispatchState && (
        <div className="space-y-1">
          <MetricPair
            label="ETA"
            value={isCompleted ? '0s' : fmtEta(dispatchState.etaRemainingS)}
            color={isCompleted ? 'text-green-400' : 'text-red-400'}
          />
          <MetricPair
            label="Distance"
            value={isCompleted ? 'Arrived' : fmtDist(dispatchState.distanceRemainingM)}
            color="text-orange-300"
          />
          <MetricPair
            label="Compute"
            value={`${dispatchState.computeMs.toFixed(1)} ms`}
            color="text-gray-400"
          />
          <MetricPair
            label="Workers"
            value={dispatchState.workersUsed > 0 ? `${dispatchState.workersUsed} threads` : '1 (seq)'}
            color={dispatchState.workersUsed > 0 ? 'text-cyan-400' : 'text-gray-500'}
          />
          {dispatchState.reroutes > 0 && (
            <MetricPair label="Reroutes" value={String(dispatchState.reroutes)} color="text-yellow-400" />
          )}
          {dispatchState.routeBlockedDetected && (
            <div className="flex items-center gap-1 rounded bg-orange-950/50 px-1.5 py-0.5">
              <AlertTriangle className="h-3 w-3 text-orange-400" />
              <span className="text-xs text-orange-400">Route blocked — rerouted</span>
            </div>
          )}
        </div>
      )}

      {/* Routing result when just computed */}
      {routing && !isActive && !isCompleted && (
        <div className="space-y-1">
          <MetricPair label="ETA" value={`~${Math.ceil(routing.estimatedTravelTimeS / 60)}m`} color="text-red-400" />
          <MetricPair label="Distance" value={`${(routing.totalDistanceM / 1000).toFixed(2)} km`} color="text-orange-300" />
          <MetricPair label="Compute" value={`${routing.totalCostS.toFixed(0)}s cost`} color="text-cyan-400" />
        </div>
      )}
    </div>
  );
}

// ─── Compact Traffic Intelligence ────────────────────────────────────────────

function TrafficIntelligence() {
  const emergencyActive    = useEmergencyStore((s) => s.emergencyActive);
  const incidents          = useEmergencyStore((s) => s.incidents);
  const rerouteCount       = useEmergencyStore((s) => s.rerouteCount);
  const autoRerouteEnabled = useEmergencyStore((s) => s.autoRerouteEnabled);
  const priorityEnabled    = useEmergencyStore((s) => s.emergencyPriorityEnabled);
  const routeQualityScore  = useEmergencyStore((s) => s.routeQualityScore);

  const activeIncidents = incidents.filter((i) => i.resolveAtTick > 0).length;
  const qualityColor = routeQualityScore >= 80 ? 'text-green-400' : routeQualityScore >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-1.5 rounded border border-gray-800 bg-gray-950 p-2.5">
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Traffic Intelligence
        </span>
      </div>

      {/* 2-col grid for key metrics */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded border border-gray-800 bg-gray-900 px-2 py-1">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <AlertTriangle className="h-3 w-3" /> Incidents
          </div>
          <p className={clsx('font-mono text-sm font-bold', activeIncidents > 0 ? 'text-orange-400' : 'text-gray-600')}>
            {activeIncidents}
          </p>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-2 py-1">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <RefreshCw className="h-3 w-3" /> Reroutes
          </div>
          <p className={clsx('font-mono text-sm font-bold', rerouteCount > 0 ? 'text-cyan-400' : 'text-gray-600')}>
            {rerouteCount}
          </p>
        </div>
      </div>

      {/* Route quality + feature pills in one row */}
      <div className="flex items-center gap-2">
        {emergencyActive && (
          <span className={clsx('font-mono text-xs font-semibold', qualityColor)}>
            Quality: {routeQualityScore.toFixed(0)}%
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Navigation className="h-3 w-3 text-gray-600" />
          <span className={clsx('rounded px-1 py-0.5 text-xs', autoRerouteEnabled ? 'bg-cyan-950 text-cyan-400' : 'bg-gray-800 text-gray-600')}>
            Reroute {autoRerouteEnabled ? 'ON' : 'OFF'}
          </span>
          <span className={clsx('rounded px-1 py-0.5 text-xs', priorityEnabled ? 'bg-green-950 text-green-400' : 'bg-gray-800 text-gray-600')}>
            TL {priorityEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function MetricsPanel() {
  const normalDispatchComparison = useEmergencyStore((s) => s.normalDispatchComparison);
  const parallelAdvantageActive  = useEmergencyStore((s) => s.parallelAdvantageActive);
  const dispatcherComparison     = useEmergencyStore((s) => s.dispatcherComparison);
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);

  const showComparisonSection = (normalDispatchComparison && !parallelAdvantageActive) || !!dispatcherComparison;

  return (
    <>
      <aside className="flex w-80 shrink-0 flex-col gap-2.5 overflow-hidden border-l border-gray-800 bg-gray-900 p-3">

        {/* ── MISSION STATUS ─────────────────────────────── */}
        <div className="space-y-1.5">
          <SectionLabel>Mission Status</SectionLabel>
          <MissionStatus />
        </div>

        {/* ── PARALLEL INSIGHT (permanent, 1 line) ──────── */}
        <div className="flex items-start gap-1.5 rounded border border-gray-800 bg-gray-900/50 px-2 py-1.5">
          <Info className="mt-px h-3 w-3 shrink-0 text-gray-600" />
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-300">Parallel ≠ faster driving.</span>
            {' '}Faster route computation → earlier dispatch.
          </p>
        </div>

        {/* ── DISPATCHER COMPARISON ─────────────────────── */}
        {normalDispatchComparison && !parallelAdvantageActive && (
          <NormalDispatchPanel comparison={normalDispatchComparison} />
        )}
        <ComparePanel />

        {showComparisonSection && <hr className="border-gray-800" />}

        {/* ── TRAFFIC INTELLIGENCE ──────────────────────── */}
        <TrafficIntelligence />

        <hr className="border-gray-800" />

        {/* ── BENCHMARK LAB BUTTON ──────────────────────── */}
        <button
          onClick={() => setBenchmarkOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded border border-cyan-800 bg-cyan-950/30 px-3 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-950/60"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Open Analysis Lab
          <span className="ml-auto rounded border border-cyan-800 px-1.5 py-0.5 text-xs text-cyan-600">
            Primary Parallel Proof
          </span>
        </button>

      </aside>

      {/* ── BENCHMARK MODAL ──────────────────────────────── */}
      {benchmarkOpen && <BenchmarkModal onClose={() => setBenchmarkOpen(false)} />}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
      {children}
    </h2>
  );
}
