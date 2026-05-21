'use client';

import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import { Car, AlertTriangle, Clock, Cpu } from 'lucide-react';
import { PerformanceChart } from '@/src/components/analytics/PerformanceChart';
import { EmergencyMetrics } from '@/src/components/analytics/EmergencyMetrics';
import { useMetricsStore } from '@/src/store/metricsStore';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  valueColor: string;
  subtext?: string;
}

function MetricCard({ icon, label, value, unit, valueColor, subtext }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-gray-600">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={clsx('font-mono text-2xl font-bold', valueColor)}>{value}</span>
        {unit && <span className="text-xs text-gray-600">{unit}</span>}
      </div>
      {subtext && <p className="mt-0.5 text-xs text-gray-600">{subtext}</p>}
    </div>
  );
}

function formatTravelTime(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function MetricsPanel() {
  const { metrics } = useMetricsStore();
  const congestionPct = Math.round(metrics.congestionLevel * 100);

  const congestionColor =
    congestionPct < 30 ? 'text-green-400' :
    congestionPct < 70 ? 'text-yellow-400' :
                         'text-red-400';

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-gray-800 bg-gray-900 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Live Metrics
      </h2>

      <MetricCard
        icon={<Car className="h-4 w-4" />}
        label="Active Vehicles"
        value={String(metrics.activeVehicles)}
        valueColor="text-cyan-400"
        subtext="vehicles currently on the map"
      />

      <MetricCard
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Congestion Level"
        value={String(congestionPct)}
        unit="%"
        valueColor={congestionColor}
        subtext="avg simulated road congestion"
      />

      <MetricCard
        icon={<Clock className="h-4 w-4" />}
        label="Emergency Response"
        value={metrics.avgEmergencyResponseMs === 0 ? '—' : formatTravelTime(metrics.avgEmergencyResponseMs)}
        valueColor="text-yellow-400"
        subtext="estimated travel time to hospital"
      />

      <MetricCard
        icon={<Cpu className="h-4 w-4" />}
        label="Worker Threads"
        value={String(metrics.workerThreadCount)}
        valueColor="text-purple-400"
        subtext="active parallel workers"
      />

      <hr className="border-gray-800" />

      <EmergencyMetrics />

      <hr className="border-gray-800" />

      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Performance
      </h2>

      <PerformanceChart />

      <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">
          Tick Rate
        </p>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-bold text-orange-400">
            {metrics.tickRateHz === 0 ? '—' : String(metrics.tickRateHz)}
          </span>
          {metrics.tickRateHz > 0 && (
            <span className="text-xs text-gray-600">Hz</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-600">simulation ticks / second</p>
      </div>
    </aside>
  );
}
