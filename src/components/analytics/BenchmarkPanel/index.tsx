'use client';

import { useState } from 'react';
import { Play, Gauge, Cpu } from 'lucide-react';
import { clsx } from 'clsx';
import { useBenchmarkStore } from '@/src/store/benchmarkStore';
import { wsService } from '@/src/services/websocketService';
import { BenchmarkChart } from '@/src/components/analytics/BenchmarkChart';
import type { BenchmarkMode } from '@/src/types/benchmark';

const CANDIDATE_OPTIONS = [50, 100, 200, 500];
const ITERATION_OPTIONS = [
  { label: 'Quick', value: 1 },
  { label: 'Standard', value: 3 },
  { label: 'Deep', value: 5 },
];

function fmt(n: number): string {
  return n.toLocaleString();
}

export function BenchmarkPanel() {
  const [candidateCount, setCandidateCount] = useState(100);
  const [iterationCount, setIterationCount] = useState(3);
  const { running, progress, result } = useBenchmarkStore();

  const run = (mode: BenchmarkMode) => {
    if (running) return;
    wsService.send('RUN_BENCHMARK', { candidateCount, iterationCount, mode });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Benchmark
        </h2>
        <span className="rounded border border-cyan-800 bg-cyan-950 px-1.5 py-0.5 text-xs font-semibold text-cyan-400">
          Primary Parallel Benchmark
        </span>
      </div>

      <p className="text-xs leading-relaxed text-gray-600">
        Evaluates N route candidate pairs using A* under 4 strategies each
        (standard, avoid-congestion, avoid-blocked, prefer-speed) — the same
        strategy set used by emergency routing. This is the correct target for
        parallelism: each candidate is independent and compute-heavy. Sequential
        scores all candidates in one thread; parallel splits them across{' '}
        <span className="text-gray-400">4 workers</span>. Timings are real
        measured wall-clock; no simulation runs during this test.
      </p>

      {/* Candidate count */}
      <div>
        <p className="mb-1.5 text-xs text-gray-500">Route candidates</p>
        <div className="flex gap-1.5">
          {CANDIDATE_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => setCandidateCount(v)}
              disabled={running}
              className={clsx(
                'flex-1 rounded border px-2 py-1 text-xs font-mono font-semibold transition-colors',
                candidateCount === v
                  ? 'border-cyan-600 bg-cyan-950 text-cyan-300'
                  : 'border-gray-700 bg-gray-900 text-gray-500 hover:border-gray-600 hover:text-gray-400',
                running && 'cursor-not-allowed opacity-40',
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-700">
          Each candidate runs 4 A* searches → {candidateCount * 4} total evaluations per iteration
        </p>
      </div>

      {/* Iteration count */}
      <div>
        <p className="mb-1.5 text-xs text-gray-500">Iterations</p>
        <div className="flex gap-1.5">
          {ITERATION_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setIterationCount(value)}
              disabled={running}
              className={clsx(
                'flex-1 rounded border px-2 py-1 text-xs font-semibold transition-colors',
                iterationCount === value
                  ? 'border-cyan-600 bg-cyan-950 text-cyan-300'
                  : 'border-gray-700 bg-gray-900 text-gray-500 hover:border-gray-600 hover:text-gray-400',
                running && 'cursor-not-allowed opacity-40',
              )}
            >
              {label}
              <span className="ml-1 font-mono text-gray-600">{value}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Run buttons */}
      <div className="grid grid-cols-1 gap-1.5">
        <RunButton
          label="Run Sequential"
          icon={<Gauge className="h-3.5 w-3.5" />}
          color="blue"
          disabled={running}
          onClick={() => run('sequential')}
        />
        <RunButton
          label="Run Parallel"
          icon={<Cpu className="h-3.5 w-3.5" />}
          color="cyan"
          disabled={running}
          onClick={() => run('parallel')}
        />
        <RunButton
          label="Run Comparison"
          icon={<Play className="h-3.5 w-3.5" />}
          color="purple"
          disabled={running}
          onClick={() => run('comparison')}
        />
      </div>

      {/* Progress */}
      {running && progress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Running…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !running && (
        <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Results — {result.candidateCount} candidates × {result.iterationCount} iterations
          </p>

          {result.sequential && (
            <ResultRow
              label="Sequential"
              totalMs={result.sequential.totalMs}
              avgMs={result.sequential.avgIterationMs}
              throughput={result.sequential.throughputCandidatesPerSec}
              color="text-blue-400"
            />
          )}

          {result.parallel && (
            <ResultRow
              label="Parallel (4 workers)"
              totalMs={result.parallel.totalMs}
              avgMs={result.parallel.avgIterationMs}
              throughput={result.parallel.throughputCandidatesPerSec}
              color="text-cyan-400"
            />
          )}

          {result.speedup !== null && (
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-gray-800 pt-2">
              <DerivedMetric
                label="Speedup"
                value={`${result.speedup}×`}
                color={result.speedup >= 1 ? 'text-green-400' : 'text-red-400'}
              />
              <DerivedMetric
                label="Efficiency"
                value={`${Math.round((result.efficiency ?? 0) * 100)}%`}
                color="text-yellow-400"
              />
              <DerivedMetric
                label="Improvement"
                value={`${result.improvementPct ?? 0}%`}
                color={(result.improvementPct ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}
              />
            </div>
          )}

          {(result.sequential || result.parallel) && <BenchmarkChart result={result} />}

          <p className="text-xs text-gray-700">
            Parallel includes worker spawn overhead. Use larger candidate counts
            for reliable speedup — overhead is amortised over more work.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RunButtonProps {
  label: string;
  icon: React.ReactNode;
  color: 'blue' | 'cyan' | 'purple';
  disabled: boolean;
  onClick: () => void;
}

const COLOR_MAP = {
  blue: 'border-blue-800 bg-blue-950/40 text-blue-300 hover:bg-blue-950/70',
  cyan: 'border-cyan-800 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-950/70',
  purple: 'border-purple-800 bg-purple-950/40 text-purple-300 hover:bg-purple-950/70',
};

function RunButton({ label, icon, color, disabled, onClick }: RunButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex items-center gap-2 rounded border px-3 py-2 text-xs font-semibold transition-colors',
        COLOR_MAP[color],
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface ResultRowProps {
  label: string;
  totalMs: number;
  avgMs: number;
  throughput: number;
  color: string;
}

function ResultRow({ label, totalMs, avgMs, throughput, color }: ResultRowProps) {
  return (
    <div>
      <p className={clsx('mb-1 text-xs font-semibold', color)}>{label}</p>
      <div className="grid grid-cols-3 gap-1 text-xs">
        <div>
          <span className="font-mono text-gray-300">{totalMs}ms</span>
          <p className="text-gray-600">total</p>
        </div>
        <div>
          <span className="font-mono text-gray-300">{avgMs}ms</span>
          <p className="text-gray-600">avg/iter</p>
        </div>
        <div>
          <span className="font-mono text-gray-300">{fmt(throughput)}</span>
          <p className="text-gray-600">cand/s</p>
        </div>
      </div>
    </div>
  );
}

interface DerivedMetricProps {
  label: string;
  value: string;
  color: string;
}

function DerivedMetric({ label, value, color }: DerivedMetricProps) {
  return (
    <div className="text-center">
      <p className={clsx('font-mono text-sm font-bold', color)}>{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}
