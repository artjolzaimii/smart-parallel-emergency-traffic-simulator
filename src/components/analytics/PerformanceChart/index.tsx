'use client';

import { BarChart2 } from 'lucide-react';
import { useMetricsStore } from '@/src/store/metricsStore';

export function PerformanceChart() {
  const { benchmark } = useMetricsStore();

  // Normalise bars so the slower one fills 100 % and the faster one scales down.
  // This makes the relative difference visible regardless of absolute magnitude.
  const maxMs = benchmark
    ? Math.max(benchmark.parallelTickMs, benchmark.sequentialTickMs, 0.001)
    : 1;

  const parPct  = benchmark ? Math.round((benchmark.parallelTickMs  / maxMs) * 100) : 0;
  const seqPct  = benchmark ? Math.round((benchmark.sequentialTickMs / maxMs) * 100) : 0;
  const ratio   = benchmark ? benchmark.parallelTickMs / Math.max(0.001, benchmark.sequentialTickMs) : null;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Live Tick Cost
        </span>
        <BarChart2 className="h-3.5 w-3.5 text-gray-700" />
      </div>
      <p className="mb-3 text-xs text-gray-700">
        Vehicle movement per tick — lightweight task; IPC overhead dominates
      </p>

      <div className="space-y-3">
        <BarRow
          label="Parallel tick"
          value={benchmark ? `${benchmark.parallelTickMs.toFixed(1)} ms` : '—'}
          fill={parPct}
          fillColor="bg-cyan-800"
        />
        <BarRow
          label="Sequential tick"
          value={benchmark ? `${benchmark.sequentialTickMs.toFixed(1)} ms` : '—'}
          fill={seqPct}
          fillColor="bg-gray-600"
        />
      </div>

      <div className="mt-3 text-center">
        {ratio === null ? (
          <p className="text-xs text-gray-700">Start simulation to see tick cost</p>
        ) : ratio > 1.05 ? (
          <p className="font-mono text-xs text-yellow-600">
            IPC overhead active — {ratio.toFixed(1)}× cost vs sequential
          </p>
        ) : ratio < 0.95 ? (
          <p className="font-mono text-xs text-cyan-500">
            {(1 / ratio).toFixed(1)}× faster in parallel
          </p>
        ) : (
          <p className="font-mono text-xs text-gray-600">tick cost roughly equal</p>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-gray-700">
        For genuine parallel speedup → see Benchmark ↓
      </p>
    </div>
  );
}

function BarRow({
  label,
  value,
  fill,
  fillColor,
}: {
  label: string;
  value: string;
  fill: number;
  fillColor: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-mono">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${fillColor}`}
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  );
}
