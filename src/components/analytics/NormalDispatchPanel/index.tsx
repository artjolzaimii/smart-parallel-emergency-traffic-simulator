'use client';

import { clsx } from 'clsx';
import { Cpu, Clock, Info, Trophy, RefreshCw, Zap } from 'lucide-react';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import type { NormalDispatchComparison } from '@/src/types/emergency';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMs(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  return ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(1)} ms`;
}

function fmtCostS(s: number): string {
  if (!s || !isFinite(s)) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ label, seq, par, seqColor, parColor }: {
  label: string;
  seq: string;
  par: string;
  seqColor?: string;
  parColor?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={clsx('font-mono text-xs font-semibold w-20 text-right', seqColor ?? 'text-gray-300')}>{seq}</span>
      <span className={clsx('font-mono text-xs font-semibold w-20 text-right', parColor ?? 'text-gray-300')}>{par}</span>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

interface Props {
  comparison: NormalDispatchComparison;
}

function SpeedupBar({ speedup }: { speedup: number }) {
  const pct = Math.min(100, Math.max(0, (speedup - 1) * 25));
  const color = speedup >= 2 ? 'bg-green-500' : speedup >= 1.3 ? 'bg-cyan-500' : speedup >= 1.05 ? 'bg-yellow-500' : 'bg-gray-600';
  return (
    <div className="mt-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function NormalDispatchPanel({ comparison }: Props) {
  const { seqComputeMs, parComputeMs, seqRouteCostS, parRouteCostS, speedupFactor, winner,
          seqRerouteMs, parRerouteMs, rerouteCount } = comparison;

  const hasSavedMs = winner === 'parallel' && (seqComputeMs - parComputeMs) > 0.5;
  const savedMs = seqComputeMs - parComputeMs;

  const winnerLabel =
    winner === 'parallel'   ? '🏆 Parallel dispatcher was faster'
    : winner === 'sequential' ? '⚡ Sequential faster for this workload'
    : '⚖️ Similar compute time';

  return (
    <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-900 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-cyan-500" />
        <span className="text-xs font-semibold uppercase tracking-widest text-cyan-600">
          Dispatcher Comparison
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 text-xs text-gray-600 uppercase tracking-wider font-semibold">
        <span></span>
        <span className="w-20 text-right text-blue-500">SEQ</span>
        <span className="w-20 text-right text-cyan-500">PAR</span>
      </div>

      {/* Dispatch compute time */}
      <div className="space-y-1.5">
        <Row
          label="Route compute"
          seq={fmtMs(seqComputeMs)}
          par={fmtMs(parComputeMs)}
          seqColor="text-blue-400"
          parColor={winner === 'parallel' ? 'text-green-400' : 'text-cyan-400'}
        />
        <Row
          label="Route cost (ETA)"
          seq={fmtCostS(seqRouteCostS)}
          par={fmtCostS(parRouteCostS)}
          seqColor="text-blue-300"
          parColor="text-cyan-300"
        />
        {(seqRerouteMs !== null || parRerouteMs !== null) && (
          <Row
            label="Reroute compute"
            seq={fmtMs(seqRerouteMs)}
            par={fmtMs(parRerouteMs)}
            seqColor="text-orange-400"
            parColor={parRerouteMs !== null && seqRerouteMs !== null && parRerouteMs < seqRerouteMs ? 'text-green-400' : 'text-cyan-400'}
          />
        )}
        {rerouteCount > 0 && (
          <Row
            label="Reroutes triggered"
            seq={String(rerouteCount)}
            par={String(rerouteCount)}
            seqColor="text-orange-300"
            parColor="text-orange-300"
          />
        )}
      </div>

      {/* Winner banner */}
      <div className="rounded border border-gray-800 bg-gray-950 px-2.5 py-2 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
            <span className="text-xs font-semibold text-yellow-300">{winnerLabel}</span>
          </div>
          <span className={clsx(
            'font-mono text-xs font-bold',
            winner === 'parallel' ? 'text-green-400' : winner === 'sequential' ? 'text-blue-400' : 'text-gray-500',
          )}>
            {speedupFactor}×
          </span>
        </div>
        <SpeedupBar speedup={speedupFactor} />
        {hasSavedMs && (
          <div className="flex items-center gap-1.5 mt-1">
            <Zap className="h-3 w-3 text-green-500 shrink-0" />
            <span className="text-xs text-gray-400">
              Parallel saved{' '}
              <span className="font-mono font-semibold text-green-400">{savedMs.toFixed(1)} ms</span>
              {' '}of dispatch compute time
            </span>
          </div>
        )}
        {winner === 'sequential' && (
          <p className="text-xs text-gray-500 mt-1">
            Sequential was faster — small workloads sometimes favour the main thread over IPC overhead.
          </p>
        )}
      </div>

      {/* Reroute comparison note */}
      {seqRerouteMs !== null && parRerouteMs !== null && (
        <div className="flex items-center gap-1.5 rounded border border-orange-900 bg-orange-950/30 px-2 py-1.5">
          <RefreshCw className="h-3 w-3 text-orange-400 shrink-0" />
          <span className="text-xs text-orange-300">
            Incident rerouting —{' '}
            {parRerouteMs < seqRerouteMs
              ? `Parallel reacted ${(seqRerouteMs - parRerouteMs).toFixed(1)} ms faster`
              : parRerouteMs > seqRerouteMs
              ? `Sequential reacted ${(parRerouteMs - seqRerouteMs).toFixed(1)} ms faster`
              : 'Similar rerouting speed'}
          </span>
        </div>
      )}

      {/* Explainer */}
      <div className="rounded border border-gray-800 bg-gray-950/50 px-2.5 py-2 space-y-1">
        <div className="flex items-center gap-1.5">
          <Info className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            What does parallel help?
          </span>
        </div>
        <p className="text-xs leading-relaxed text-gray-600">
          Parallel programming does{' '}
          <span className="text-gray-400 font-medium">not</span> make the ambulance drive faster.
          It makes the <span className="text-cyan-400 font-medium">dispatch system compute routes faster</span>:
          4 strategy variants run simultaneously in worker threads (standard, avoid-congestion,
          avoid-blocked, prefer-speed), so the dispatcher reacts sooner to congestion and incidents.
        </p>
        <p className="text-xs leading-relaxed text-gray-600 mt-1">
          One ambulance is shown because both dispatchers calculate a route for the same vehicle —
          the faster parallel route wins. Use{' '}
          <span className="text-cyan-300 font-medium">Run Parallel Advantage Scenario</span> to see
          two ambulances with visible computation delay difference.
        </p>
      </div>

      {/* Strategy info */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 text-gray-600 shrink-0" />
        <span className="text-xs text-gray-600">
          SEQ: 1 strategy (standard A*) · PAR: 4 strategies × 4 workers
        </span>
      </div>
    </div>
  );
}
