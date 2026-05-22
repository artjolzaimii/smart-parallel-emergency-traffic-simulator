'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { FullBenchmarkResult } from '@/src/types/benchmark';

interface Props {
  result: FullBenchmarkResult;
}

export function BenchmarkChart({ result }: Props) {
  const data = [
    result.sequential
      ? {
          name: 'Sequential',
          throughput: result.sequential.throughputCandidatesPerSec,
          fill: '#3b82f6',
        }
      : null,
    result.parallel
      ? {
          name: 'Parallel',
          throughput: result.parallel.throughputCandidatesPerSec,
          fill: '#22d3ee',
        }
      : null,
  ].filter((d): d is NonNullable<typeof d> => d !== null);

  if (data.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Throughput (candidates / sec)
      </p>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              fontSize: 11,
              color: '#d1d5db',
            }}
            formatter={(value) => [(value as number).toLocaleString(), 'cand/s']}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="throughput" radius={[3, 3, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
