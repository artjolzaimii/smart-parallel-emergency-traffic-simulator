'use client';

import { clsx } from 'clsx';
import {
  GitCompare, Trophy, Cpu, Clock, Navigation, AlertTriangle,
  Info, Gauge, Timer, Zap, AlertCircle,
} from 'lucide-react';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import type { CompareDispatchState, DispatcherComparison } from '@/src/types/emergency';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtEta(s: number): string {
  if (s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`;
}

const STATUS_LABELS: Record<string, string> = {
  routing:   'Computing route…',
  active:    'En Route',
  rerouting: 'Rerouting…',
  completed: 'Arrived ✓',
  idle:      'Idle',
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
      <div
        className={clsx('h-full rounded-full transition-all duration-300', color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Compute delay meter ──────────────────────────────────────────────────────

function DelayMeter({ ds }: { ds: CompareDispatchState }) {
  if (ds.dispatchDelayTicks === 0) return null;

  const done = ds.ticksWaited >= ds.dispatchDelayTicks;
  const waitPct = Math.min(100, (ds.ticksWaited / Math.max(1, ds.dispatchDelayTicks)) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Timer className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="text-xs text-gray-500">Compute wait</span>
        </div>
        <span className={clsx('font-mono text-xs font-semibold', done ? 'text-green-400' : 'text-orange-400')}>
          {done ? 'Done — moving' : `${ds.ticksWaited}/${ds.dispatchDelayTicks} ticks`}
        </span>
      </div>
      <ProgressBar pct={done ? 100 : waitPct} color={done ? 'bg-green-500' : 'bg-orange-500'} />
    </div>
  );
}

// ─── Single-dispatcher column ─────────────────────────────────────────────────

interface ColProps {
  ds: CompareDispatchState;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  label: string;
  icon: string;
  showDelay: boolean;
}

function Row({ name, value, valueClass }: { name: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500">{name}</span>
      <span className={clsx('font-mono text-xs font-semibold', valueClass ?? 'text-gray-300')}>{value}</span>
    </div>
  );
}

function DispatcherCol({ ds, accentColor, borderColor, bgColor, label, icon, showDelay }: ColProps) {
  const statusClass =
    ds.status === 'completed' ? 'text-green-400'
    : ds.status === 'rerouting' ? 'text-orange-400'
    : ds.status === 'active'   ? accentColor
    : 'text-gray-500';

  const isWaiting = showDelay && ds.ticksWaited < ds.dispatchDelayTicks && ds.status === 'active';

  return (
    <div className={clsx('flex-1 rounded-lg border p-3 space-y-2', borderColor, bgColor)}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <span className={clsx('text-xs font-bold uppercase tracking-wider', accentColor)}>{label}</span>
      </div>

      <div className="space-y-1.5">
        <Row
          name="Status"
          value={isWaiting ? `Waiting (${ds.ticksWaited}/${ds.dispatchDelayTicks}t)` : STATUS_LABELS[ds.status] ?? ds.status}
          valueClass={isWaiting ? 'text-orange-400' : statusClass}
        />
        <Row
          name="Compute time"
          value={fmtMs(ds.finalComputeMs)}
          valueClass={accentColor}
        />
        {showDelay && (
          <Row
            name="Dispatch delay"
            value={ds.dispatchDelayTicks > 0 ? `${ds.dispatchDelayTicks} ticks` : 'Instant'}
            valueClass={ds.dispatchDelayTicks > 0 ? 'text-orange-400' : 'text-green-400'}
          />
        )}
        <Row
          name="Reroutes"
          value={String(ds.reroutes)}
          valueClass={ds.reroutes > 0 ? 'text-orange-400' : 'text-gray-500'}
        />
        <Row
          name="ETA remaining"
          value={ds.status === 'completed' ? '0s' : fmtEta(ds.etaRemainingS)}
          valueClass={ds.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}
        />
        <Row
          name="Distance left"
          value={ds.status === 'completed' ? '0 m' : fmtDist(ds.distanceRemainingM)}
          valueClass="text-orange-300"
        />
        <Row
          name="Workers"
          value={ds.workersUsed > 0 ? `${ds.workersUsed} threads` : 'single thread'}
          valueClass={ds.workersUsed > 0 ? 'text-purple-400' : 'text-gray-500'}
        />
        <Row
          name="Strategy"
          value={ds.selectedStrategy.replace(/-/g, ' ')}
          valueClass="text-gray-400"
        />
        {ds.totalResponseTimeS !== null && (
          <Row
            name="Total time"
            value={fmtEta(ds.totalResponseTimeS)}
            valueClass="text-green-400"
          />
        )}
        {ds.routeBlockedDetected && (
          <div className="flex items-center gap-1 rounded bg-orange-950/50 px-1.5 py-1">
            <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0" />
            <span className="text-xs text-orange-400">Blocked — rerouted</span>
          </div>
        )}
      </div>

      {/* Route progress bar */}
      {ds.status === 'active' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Route progress</span>
            <span className={clsx('font-mono text-xs font-semibold', accentColor)}>
              {ds.routeProgressPct?.toFixed(0) ?? 0}%
            </span>
          </div>
          <ProgressBar pct={ds.routeProgressPct ?? 0} color={label === 'SEQ' ? 'bg-blue-500' : 'bg-cyan-500'} />
        </div>
      )}

      {/* Delay meter (only in advantage scenario) */}
      {showDelay && <DelayMeter ds={ds} />}
    </div>
  );
}

// ─── Prominent result banner ──────────────────────────────────────────────────

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

  const parProgress = par.routeProgressPct ?? 0;
  const seqProgress = seq.routeProgressPct ?? 0;
  const progressDiff = parProgress - seqProgress;

  const isParWinner = winner === 'parallel';
  const isSeqWinner = winner === 'sequential';

  return (
    <div className={clsx(
      'rounded-lg border px-3 py-2.5 space-y-2',
      isParWinner ? 'border-green-800 bg-green-950/30' : isSeqWinner ? 'border-yellow-800 bg-yellow-950/20' : 'border-gray-700 bg-gray-900',
    )}>
      {/* Main winner line */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Trophy className={clsx('h-4 w-4', isParWinner ? 'text-green-400' : isSeqWinner ? 'text-yellow-400' : 'text-gray-500')} />
          <span className={clsx('text-xs font-semibold', isParWinner ? 'text-green-300' : isSeqWinner ? 'text-yellow-300' : 'text-gray-400')}>
            {isParWinner ? '🏁 Parallel computed route faster'
             : isSeqWinner ? '🏁 Sequential computed route faster this run'
             : '⚖️ Roughly equal compute time'}
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-cyan-400">
          {speedupFactor}× speedup
        </span>
      </div>

      {/* Tick head-start */}
      {comparison.parallelAdvantageActive && typeof tickAdvantage === 'number' && tickAdvantage !== 0 && (
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-green-500 shrink-0" />
          <span className="text-xs text-gray-300">
            {tickAdvantage > 0
              ? <><span className="font-mono font-bold text-green-400">PAR started {tickAdvantage} ticks earlier</span> — head start from faster dispatch</>
              : <><span className="font-mono font-bold text-blue-400">SEQ started {Math.abs(tickAdvantage)} ticks earlier</span></>}
          </span>
        </div>
      )}

      {/* Compute time saved */}
      {savedMs > 0.5 && (
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="text-xs text-gray-400">
            {isParWinner ? 'Parallel' : 'Sequential'} saved{' '}
            <span className="font-mono font-semibold text-green-400">{fmtMs(savedMs)}</span>
            {' '}of dispatch computation
          </span>
        </div>
      )}

      {/* Route progress difference */}
      {comparison.parallelAdvantageActive && Math.abs(progressDiff) > 0.5 && (
        <div className="flex items-center gap-2">
          <Gauge className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="text-xs text-gray-400">
            {progressDiff > 0 ? 'PAR' : 'SEQ'} is{' '}
            <span className="font-mono font-semibold text-cyan-400">{Math.abs(progressDiff).toFixed(0)}%</span>
            {' '}ahead on route progress
          </span>
        </div>
      )}

      {/* Reroutes */}
      <div className="flex items-center gap-2">
        <Navigation className="h-3 w-3 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-400">
          Reroutes — SEQ:{' '}
          <span className="font-mono font-semibold text-blue-400">{seq.reroutes}</span>
          {' '}· PAR:{' '}
          <span className="font-mono font-semibold text-cyan-400">{par.reroutes}</span>
        </span>
      </div>

      {/* Honest same-speed note */}
      <div className="rounded border border-gray-800 bg-gray-900/50 px-2 py-1">
        <p className="text-xs text-gray-600">
          Both ambulances drive at the <span className="text-gray-400 font-medium">same speed</span>.
          Advantage is purely from faster route computation.
        </p>
      </div>
    </div>
  );
}

// ─── Hint when sequential wins ────────────────────────────────────────────────

function SlowHint({ comparison }: { comparison: DispatcherComparison }) {
  if (comparison.winner !== 'sequential') return null;

  return (
    <div className="rounded-lg border border-yellow-900 bg-yellow-950/20 px-3 py-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
        <span className="text-xs font-semibold text-yellow-600">Parallel overhead still dominant</span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">
        On this run, worker startup + IPC overhead outweighed the parallel computation gain.
        Try <span className="text-yellow-400 font-medium">Extreme workload (2 000 candidates)</span> for
        a larger task size where parallelism clearly wins.
      </p>
    </div>
  );
}

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
    <div className={clsx('rounded border px-2 py-1 flex items-center justify-between', colors[workload])}>
      <span className="text-xs font-semibold uppercase tracking-wider">{workload} workload</span>
      <span className="font-mono text-xs">{totalEvaluations.toLocaleString()} A* evals (4 workers)</span>
    </div>
  );
}

// ─── Advantage scenario explainer ────────────────────────────────────────────

function AdvantageExplainer({ comparison }: { comparison: DispatcherComparison }) {
  const cands = comparison.totalEvaluations ? comparison.totalEvaluations / 4 : 1000;
  return (
    <div className="rounded-lg border border-cyan-900 bg-cyan-950/20 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
          Parallel Advantage Scenario
        </span>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">
        Both ambulances drive at <span className="text-gray-300 font-medium">exactly the same speed</span>.
        The only difference is when they <em>start moving</em>: each ambulance waits at the station while
        its dispatcher computes the route.
      </p>
      <p className="text-xs leading-relaxed text-gray-500">
        The <span className="text-cyan-400 font-medium">PAR</span> dispatcher splits{' '}
        <span className="text-cyan-400 font-medium">{cands.toLocaleString()} candidates × 4 strategies
        = {(cands * 4).toLocaleString()} A* evaluations</span> across 4{' '}
        <span className="text-cyan-400 font-medium">persistent worker threads</span> (graph cached — no
        respawn overhead). The{' '}
        <span className="text-blue-400 font-medium">SEQ</span> dispatcher evaluates the same{' '}
        {(cands * 4).toLocaleString()} A* runs <span className="text-blue-400 font-medium">one by one</span>{' '}
        in the main thread.
      </p>
      <p className="text-xs leading-relaxed text-gray-500">
        Scale: <span className="text-gray-300 font-medium">30 ms of compute = 1 tick of ambulance wait</span>.
        Each tick the ambulance advances 10 simulated seconds along its route.
      </p>
    </div>
  );
}

function StandardExplainer() {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          What does parallel mean here?
        </span>
      </div>
      <p className="text-xs leading-relaxed text-gray-600">
        Parallel programming does <span className="text-gray-400 font-medium">not</span> make the ambulance drive faster.
        It makes the route optimisation engine evaluate{' '}
        <span className="text-cyan-400 font-medium">4 strategies simultaneously</span> using worker threads
        (standard, avoid-congestion, avoid-blocked, prefer-speed), so the system reacts faster when
        congestion or incidents appear.
      </p>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ComparePanel() {
  const comparison = useEmergencyStore((s) => s.dispatcherComparison);

  if (!comparison) return null;

  const isAdvantageScenario = comparison.parallelAdvantageActive;

  return (
    <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-cyan-500" />
        <span className="text-xs font-semibold uppercase tracking-widest text-cyan-600">
          {isAdvantageScenario ? 'Parallel Advantage — Live Race' : 'Dispatcher Comparison'}
        </span>
        <Cpu className="ml-auto h-3.5 w-3.5 text-gray-600" />
      </div>

      {/* Workload badge (advantage scenario only) */}
      {isAdvantageScenario && <WorkloadBadge comparison={comparison} />}

      {/* Prominent result banner (once we have speedup data) */}
      {comparison.speedupFactor !== null && <ResultBanner comparison={comparison} />}

      {/* Hint when sequential wins */}
      {isAdvantageScenario && <SlowHint comparison={comparison} />}

      {/* Two ambulance columns */}
      <div className="flex gap-2">
        <DispatcherCol
          ds={comparison.sequential}
          label="SEQ"
          icon="🔵"
          accentColor="text-blue-400"
          borderColor="border-blue-900"
          bgColor="bg-blue-950/20"
          showDelay={isAdvantageScenario}
        />
        <DispatcherCol
          ds={comparison.parallel}
          label="PAR"
          icon="🟦"
          accentColor="text-cyan-400"
          borderColor="border-cyan-900"
          bgColor="bg-cyan-950/20"
          showDelay={isAdvantageScenario}
        />
      </div>

      {/* Explainer — different text for advantage scenario vs standard compare */}
      {isAdvantageScenario ? <AdvantageExplainer comparison={comparison} /> : <StandardExplainer />}
    </div>
  );
}
