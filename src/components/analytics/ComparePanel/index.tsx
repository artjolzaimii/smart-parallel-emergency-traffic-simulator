'use client';

import { clsx } from 'clsx';
import {
  GitCompare, Trophy, Cpu, Clock,
  Zap, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import { wsService } from '@/src/services/websocketService';
import type { CompareDispatchState, DispatcherComparison } from '@/src/types/emergency';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtEta(s: number): string {
  if (s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`;
}

const STATUS_LABELS: Record<string, string> = {
  routing:   'Computing…',
  active:    'En Route',
  rerouting: 'Rerouting…',
  completed: 'Arrived ✓',
  idle:      'Idle',
};

// ─── Workload badge ───────────────────────────────────────────────────────────

function WorkloadBadge({ comparison }: { comparison: DispatcherComparison }) {
  const { workload, totalEvaluations } = comparison;
  if (!workload || !totalEvaluations) return null;

  const colors: Record<string, string> = {
    standard: 'border-gray-700 text-gray-400',
    heavy:    'border-cyan-800 text-cyan-500',
    extreme:  'border-purple-800 text-purple-400',
  };

  return (
    <div className={clsx('flex items-center justify-between rounded border px-2 py-1', colors[workload])}>
      <span className="text-xs font-semibold uppercase tracking-wider">{workload} workload</span>
      <span className="font-mono text-xs">{totalEvaluations.toLocaleString()} A* evals</span>
    </div>
  );
}

// ─── Result banner ────────────────────────────────────────────────────────────

function ResultBanner({ comparison }: { comparison: DispatcherComparison }) {
  const { speedupFactor, winner, tickAdvantage } = comparison;
  const seq = comparison.sequential;
  const par = comparison.parallel;

  if (!speedupFactor) return null;

  const savedMs = winner === 'parallel'
    ? seq.finalComputeMs - par.finalComputeMs
    : winner === 'sequential'
    ? par.finalComputeMs - seq.finalComputeMs
    : 0;

  const isParWinner = winner === 'parallel';
  const isSeqWinner = winner === 'sequential';

  return (
    <div className={clsx(
      'rounded-lg border px-3 py-2.5 space-y-1.5',
      isParWinner ? 'border-green-800 bg-green-950/30'
        : isSeqWinner ? 'border-yellow-800 bg-yellow-950/20'
        : 'border-gray-700 bg-gray-900',
    )}>
      {/* Winner + speedup */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Trophy className={clsx('h-3.5 w-3.5 shrink-0', isParWinner ? 'text-green-400' : isSeqWinner ? 'text-yellow-400' : 'text-gray-500')} />
          <span className={clsx('text-xs font-semibold', isParWinner ? 'text-green-300' : isSeqWinner ? 'text-yellow-300' : 'text-gray-400')}>
            {isParWinner ? 'Parallel computed faster'
              : isSeqWinner ? 'Sequential computed faster'
              : 'Roughly equal'}
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-cyan-400">{speedupFactor}× speedup</span>
      </div>

      {/* Tick head-start */}
      {comparison.parallelAdvantageActive && typeof tickAdvantage === 'number' && tickAdvantage !== 0 && (
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 shrink-0 text-green-500" />
          <span className="text-xs text-gray-300">
            {tickAdvantage > 0
              ? <><span className="font-mono font-bold text-green-400">PAR started {tickAdvantage} ticks earlier</span></>
              : <><span className="font-mono font-bold text-blue-400">SEQ started {Math.abs(tickAdvantage)} ticks earlier</span></>}
          </span>
        </div>
      )}

      {/* Compute saved */}
      {savedMs > 0.5 && (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0 text-gray-500" />
          <span className="text-xs text-gray-400">
            {isParWinner ? 'Parallel' : 'Sequential'} saved{' '}
            <span className="font-mono font-semibold text-green-400">{fmtMs(savedMs)}</span>
            {' '}of dispatch computation
          </span>
        </div>
      )}

      {/* Same speed note */}
      <div className="rounded border border-gray-800 bg-gray-900/50 px-2 py-1">
        <p className="text-xs text-gray-600">
          Both ambulances drive at the <span className="font-medium text-gray-400">same speed</span>.
          Advantage is purely from faster route computation.
        </p>
      </div>
    </div>
  );
}

// ─── Slow hint ────────────────────────────────────────────────────────────────

function SlowHint({ comparison }: { comparison: DispatcherComparison }) {
  if (comparison.winner !== 'sequential') return null;
  return (
    <div className="rounded-lg border border-yellow-900 bg-yellow-950/20 px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-yellow-600" />
        <span className="text-xs font-semibold text-yellow-600">Parallel overhead dominant</span>
      </div>
      <p className="text-xs leading-relaxed text-gray-600">
        Worker startup + IPC overhead outweighed parallel gain on this run.
        Try <span className="font-medium text-yellow-400">Extreme workload</span> for a
        task size where parallelism clearly wins.
      </p>
    </div>
  );
}

// ─── Comparison table ─────────────────────────────────────────────────────────

type TableRow = {
  label: string;
  seq: string;
  par: string;
  seqColor: string;
  parColor: string;
};

function ComparisonTable({ comparison, isAdvantageScenario }: {
  comparison: DispatcherComparison;
  isAdvantageScenario: boolean;
}) {
  const seq = comparison.sequential;
  const par = comparison.parallel;

  const seqWaiting = isAdvantageScenario
    && seq.ticksWaited < seq.dispatchDelayTicks
    && seq.status === 'active';
  const parWaiting = isAdvantageScenario
    && par.ticksWaited < par.dispatchDelayTicks
    && par.status === 'active';

  const rows: TableRow[] = [];

  rows.push({
    label: 'Status',
    seq: seqWaiting
      ? `${seq.ticksWaited}/${seq.dispatchDelayTicks}t wait`
      : (STATUS_LABELS[seq.status] ?? seq.status),
    par: parWaiting
      ? `${par.ticksWaited}/${par.dispatchDelayTicks}t wait`
      : (STATUS_LABELS[par.status] ?? par.status),
    seqColor: seqWaiting ? 'text-orange-400'
      : seq.status === 'completed' ? 'text-green-400'
      : seq.status === 'active' ? 'text-blue-400' : 'text-gray-500',
    parColor: parWaiting ? 'text-orange-400'
      : par.status === 'completed' ? 'text-green-400'
      : par.status === 'active' ? 'text-cyan-400' : 'text-gray-500',
  });

  rows.push({
    label: 'Compute',
    seq: fmtMs(seq.finalComputeMs),
    par: fmtMs(par.finalComputeMs),
    seqColor: 'text-blue-400',
    parColor: 'text-cyan-400',
  });

  if (isAdvantageScenario) {
    rows.push({
      label: 'Dispatch delay',
      seq: seq.dispatchDelayTicks > 0 ? `${seq.dispatchDelayTicks} ticks` : 'instant',
      par: par.dispatchDelayTicks > 0 ? `${par.dispatchDelayTicks} ticks` : 'instant',
      seqColor: seq.dispatchDelayTicks > 0 ? 'text-orange-400' : 'text-green-400',
      parColor: par.dispatchDelayTicks > 0 ? 'text-orange-400' : 'text-green-400',
    });
  }

  rows.push({
    label: 'Progress',
    seq: `${(seq.routeProgressPct ?? 0).toFixed(0)}%`,
    par: `${(par.routeProgressPct ?? 0).toFixed(0)}%`,
    seqColor: 'text-blue-300',
    parColor: 'text-cyan-300',
  });

  rows.push({
    label: 'Reroutes',
    seq: String(seq.reroutes),
    par: String(par.reroutes),
    seqColor: seq.reroutes > 0 ? 'text-orange-400' : 'text-gray-500',
    parColor: par.reroutes > 0 ? 'text-orange-400' : 'text-gray-500',
  });

  rows.push({
    label: 'Workers',
    seq: seq.workersUsed > 0 ? String(seq.workersUsed) : '1',
    par: par.workersUsed > 0 ? String(par.workersUsed) : '1',
    seqColor: 'text-gray-400',
    parColor: par.workersUsed > 0 ? 'text-purple-400' : 'text-gray-400',
  });

  if (seq.totalResponseTimeS !== null || par.totalResponseTimeS !== null) {
    rows.push({
      label: 'Total time',
      seq: seq.totalResponseTimeS !== null ? fmtEta(seq.totalResponseTimeS) : '—',
      par: par.totalResponseTimeS !== null ? fmtEta(par.totalResponseTimeS) : '—',
      seqColor: 'text-green-400',
      parColor: 'text-green-400',
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="py-2 pl-3 pr-2 text-left font-semibold uppercase tracking-wider text-gray-600">
              Metric
            </th>
            <th className="py-2 px-2 text-right font-semibold uppercase tracking-wider text-blue-500">
              SEQ
            </th>
            <th className="py-2 pl-2 pr-3 text-right font-semibold uppercase tracking-wider text-cyan-500">
              PAR
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className={i > 0 ? 'border-t border-gray-800/50' : ''}>
              <td className="py-1.5 pl-3 pr-2 text-gray-500">{r.label}</td>
              <td className={clsx('py-1.5 px-2 text-right font-mono font-semibold', r.seqColor)}>
                {r.seq}
              </td>
              <td className={clsx('py-1.5 pl-2 pr-3 text-right font-mono font-semibold', r.parColor)}>
                {r.par}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dual progress bars ───────────────────────────────────────────────────────

function DualProgressBars({ seq, par }: { seq: CompareDispatchState; par: CompareDispatchState }) {
  const seqActive = seq.status === 'active' || seq.status === 'completed';
  const parActive = par.status === 'active' || par.status === 'completed';
  if (!seqActive && !parActive) return null;

  const seqPct = Math.max(0, Math.min(100, seq.routeProgressPct ?? 0));
  const parPct = Math.max(0, Math.min(100, par.routeProgressPct ?? 0));

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Route Progress</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-7 text-right text-xs font-bold text-blue-500">SEQ</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${seqPct}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-xs text-blue-300">{seqPct.toFixed(0)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-7 text-right text-xs font-bold text-cyan-500">PAR</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-300"
              style={{ width: `${parPct}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-xs text-cyan-300">{parPct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ComparePanel() {
  const comparison           = useEmergencyStore((s) => s.dispatcherComparison);
  const parallelAdvantageActive = useEmergencyStore((s) => s.parallelAdvantageActive);

  if (!comparison) return null;

  const isAdvantageScenario = comparison.parallelAdvantageActive;
  // Show "demo completed" badge when scenario finished but results still visible
  const demoFinished = isAdvantageScenario
    && !parallelAdvantageActive
    && (comparison.sequential.status === 'completed' || comparison.parallel.status === 'completed');

  return (
    <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-cyan-500" />
        <span className="text-xs font-semibold uppercase tracking-widest text-cyan-600">
          {isAdvantageScenario ? 'Parallel Advantage — Live Race' : 'Dispatcher Comparison'}
        </span>
        {demoFinished && (
          <span className="rounded border border-green-800 bg-green-950/30 px-1.5 py-0.5 text-xs font-semibold text-green-400">
            Done
          </span>
        )}
        {demoFinished ? (
          <button
            onClick={() => wsService.send('RESET_SIMULATION')}
            className="ml-auto flex items-center gap-1 rounded border border-gray-700 bg-gray-800 px-2 py-0.5 text-xs text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors"
            title="Reset to run demo again"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
        ) : (
          <Cpu className="ml-auto h-3.5 w-3.5 text-gray-600" />
        )}
      </div>

      {/* Workload badge */}
      {isAdvantageScenario && <WorkloadBadge comparison={comparison} />}

      {/* Result banner */}
      {comparison.speedupFactor !== null && <ResultBanner comparison={comparison} />}

      {/* Slow hint */}
      {isAdvantageScenario && <SlowHint comparison={comparison} />}

      {/* Compact comparison table — no side-by-side overflow */}
      <ComparisonTable comparison={comparison} isAdvantageScenario={isAdvantageScenario} />

      {/* Dual progress bars */}
      <DualProgressBars seq={comparison.sequential} par={comparison.parallel} />

      {/* Brief explainer — full detail in How It Works modal */}
      <p className="text-xs text-gray-700">
        {isAdvantageScenario
          ? 'Both ambulances drive at identical speed. Advantage = faster route computation.'
          : 'PAR evaluates 4 strategies simultaneously. Ambulance follows the fastest result.'}
      </p>
    </div>
  );
}
