'use client';

import { BarChart2 } from 'lucide-react';
import { useMetricsStore } from '@/src/store/metricsStore';

export function PerformanceChart() {
  const { benchmark } = useMetricsStore();

  const parallelPct = benchmark
    ? Math.min(100, (1 / benchmark.parallelTickMs) * 100)
    : 0;
  const sequentialPct = benchmark
    ? Math.min(100, (1 / benchmark.sequentialTickMs) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Parallel vs Sequential
        </span>
        <BarChart2 className="h-3.5 w-3.5 text-gray-700" />
      </div>

      <div className="space-y-3">
        <BarRow
          label="Parallel"
          value={benchmark ? `${benchmark.parallelTickMs.toFixed(1)} ms` : '—'}
          fill={parallelPct}
          fillColor="bg-cyan-700"
        />
        <BarRow
          label="Sequential"
          value={benchmark ? `${benchmark.sequentialTickMs.toFixed(1)} ms` : '—'}
          fill={sequentialPct}
          fillColor="bg-gray-600"
        />
      </div>

      {benchmark ? (
        <p className="mt-3 text-center font-mono text-xs text-cyan-500">
          {benchmark.speedupFactor.toFixed(2)}× speedup
        </p>
      ) : (
        <p className="mt-3 text-center text-xs text-gray-700">
          Start simulation to compare
        </p>
      )}
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
