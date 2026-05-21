'use client';

import { clsx } from 'clsx';
import { Siren } from 'lucide-react';
import { useMetricsStore } from '@/src/store/metricsStore';
import { useSimulationStore } from '@/src/store/simulationStore';

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-gray-800 bg-gray-900 px-2 py-1.5">
      <p className="mb-0.5 text-xs text-gray-600">{label}</p>
      <p className={clsx('font-mono text-sm font-bold', color)}>{value}</p>
    </div>
  );
}

function TimingRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={clsx('font-mono text-xs', color)}>{value}</span>
    </div>
  );
}

export function EmergencyMetrics() {
  const routing = useMetricsStore((s) => s.routing);
  // Always reflect the current simulation mode, not the stale routing result
  const currentMode = useSimulationStore((s) => s.config.mode);

  if (!routing) {
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

  const distKm   = (routing.totalDistanceM / 1000).toFixed(2);
  const travelMin = Math.ceil(routing.estimatedTravelTimeS / 60);

  const hasSpeedup = routing.speedupFactor !== null;
  const isActualSpeedup = hasSpeedup && routing.speedupFactor! >= 1.0;

  return (
    <div className="space-y-3 rounded-lg border border-red-900 bg-gray-950 p-3">
      <div className="flex items-center gap-2">
        <Siren className="h-4 w-4 animate-pulse text-red-400" />
        <span className="text-xs font-semibold uppercase tracking-widest text-red-500">
          Emergency Active
        </span>
        {/* Show current mode — always in sync with the rest of the UI */}
        <span className="ml-auto font-mono text-xs capitalize text-gray-600">
          {currentMode}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBox label="ETA"        value={`~${travelMin} min`}                color="text-red-400" />
        <StatBox label="Distance"   value={`${distKm} km`}                     color="text-orange-400" />
        <StatBox label="Roads Eval" value={String(routing.roadsEvaluated)}      color="text-yellow-400" />
        <StatBox label="Route Cost" value={`${routing.totalCostS.toFixed(0)}s`} color="text-cyan-400" />
      </div>

      <div className="space-y-1.5 border-t border-gray-800 pt-2">
        <TimingRow
          label="Sequential"
          value={`${routing.sequentialMs.toFixed(1)} ms`}
          color="text-gray-400"
        />
        {routing.parallelMs !== null && (
          <TimingRow
            label="Parallel"
            value={`${routing.parallelMs.toFixed(1)} ms`}
            color="text-cyan-400"
          />
        )}
        {hasSpeedup && (
          isActualSpeedup ? (
            <TimingRow
              label="Speedup"
              value={`${routing.speedupFactor!.toFixed(2)}×`}
              color="text-green-400"
            />
          ) : (
            <TimingRow
              label="Parallel overhead"
              value={`${(1 / routing.speedupFactor!).toFixed(2)}× slower`}
              color="text-yellow-500"
            />
          )
        )}
        <TimingRow
          label="Strategy"
          value={routing.strategy.replace(/-/g, ' ')}
          color="text-purple-400"
        />
      </div>
    </div>
  );
}
