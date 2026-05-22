'use client';

import { clsx } from 'clsx';
import { Lock, ArrowDownUp, ShieldAlert } from 'lucide-react';
import { useMetricsStore } from '@/src/store/metricsStore';

function Row({ label, value, color, title }: { label: string; value: string | number; color: string; title?: string }) {
  return (
    <div className="flex items-center justify-between" title={title}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className={clsx('font-mono text-xs font-semibold', color)}>{value}</span>
    </div>
  );
}

function MiniDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-600">{label}</span>
      <div className="flex-1 border-t border-gray-800" />
    </div>
  );
}

export function SyncPanel() {
  const s = useMetricsStore((state) => state.syncMetrics);

  return (
    <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-950 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Synchronization
        </span>
      </div>

      {/* Semaphore section */}
      <MiniDivider label="Semaphore (intersections)" />
      <div className="space-y-1">
        <Row
          label="Controlled nodes"
          value={s.controlledIntersections}
          color="text-gray-400"
          title="Intersections modelled as critical sections (~15 % of graph nodes)"
        />
        <Row
          label="Permits acquired"
          value={s.semaphoreAcquisitions.toLocaleString()}
          color="text-cyan-400"
          title="Total successful P(s) / wait() operations"
        />
        <Row
          label="Permit waits"
          value={s.semaphoreWaits.toLocaleString()}
          color={s.semaphoreWaits > 0 ? 'text-yellow-400' : 'text-gray-600'}
          title="Total V(s) / signal() operations deferred — vehicle blocked"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Blocked this tick</span>
          <span
            className={clsx(
              'flex h-5 min-w-[1.5rem] items-center justify-center rounded px-1 font-mono text-xs font-bold',
              s.blockedThisTick > 0
                ? 'bg-yellow-950 text-yellow-400'
                : 'bg-gray-900 text-gray-600',
            )}
          >
            {s.blockedThisTick}
          </span>
        </div>
      </div>

      {/* Queue section */}
      <MiniDivider label="Queue (producer-consumer)" />
      <div className="space-y-1">
        <Row
          label="Requests produced"
          value={s.emergencyProduced}
          color="text-purple-400"
          title="Emergency dispatch requests enqueued by user"
        />
        <Row
          label="Requests consumed"
          value={s.emergencyConsumed}
          color="text-green-400"
          title="Requests processed by the engine tick loop"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Pending in queue</span>
          <span
            className={clsx(
              'flex h-5 min-w-[1.5rem] items-center justify-center rounded px-1 font-mono text-xs font-bold',
              s.emergencyPending > 0
                ? 'bg-purple-950 text-purple-400'
                : 'bg-gray-900 text-gray-600',
            )}
          >
            {s.emergencyPending}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-0.5 border-t border-gray-800 pt-2">
        <div className="flex items-start gap-1.5">
          <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-gray-700" />
          <p className="text-xs leading-relaxed text-gray-700">
            Intersections = critical sections. Vehicles acquire a semaphore permit
            before entering; if at capacity, movement is deferred one tick.
          </p>
        </div>
        <div className="flex items-start gap-1.5">
          <ArrowDownUp className="mt-0.5 h-3 w-3 shrink-0 text-gray-700" />
          <p className="text-xs leading-relaxed text-gray-700">
            Emergency button = producer. Engine tick = consumer. Queue decouples
            dispatch requests from route computation.
          </p>
        </div>
      </div>
    </div>
  );
}
