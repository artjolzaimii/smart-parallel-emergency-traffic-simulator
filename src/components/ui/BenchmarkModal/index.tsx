'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FlaskConical, Lock, BarChart2 } from 'lucide-react';
import { BenchmarkPanel } from '@/src/components/analytics/BenchmarkPanel';
import { SyncPanel } from '@/src/components/analytics/SyncPanel';
import { PerformanceChart } from '@/src/components/analytics/PerformanceChart';
import { EventTimeline } from '@/src/components/analytics/EventTimeline';
import { useMetricsStore } from '@/src/store/metricsStore';

type Tab = 'benchmark' | 'diagnostics' | 'sync' | 'events';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'benchmark',   label: 'Benchmark Lab',       icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { id: 'diagnostics', label: 'Live Diagnostics',    icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { id: 'sync',        label: 'Synchronization',     icon: <Lock className="h-3.5 w-3.5" /> },
  { id: 'events',      label: 'Event Log',            icon: <span className="text-xs">📋</span> },
];

interface Props {
  onClose: () => void;
}

export function BenchmarkModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('benchmark');
  const { metrics } = useMetricsStore();

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-800 px-5 py-3">
          <FlaskConical className="h-4 w-4 text-cyan-500" />
          <h2 className="text-sm font-bold tracking-widest text-gray-100">Analysis Lab</h2>
          <span className="ml-auto text-xs text-gray-600">Press Esc to close</span>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-500 hover:text-gray-400'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'benchmark' && <BenchmarkPanel />}

          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
                <p className="text-xs text-gray-500">
                  Vehicle update overhead per tick. In parallel mode, IPC serialization cost often exceeds compute
                  savings for lightweight movement tasks — this is expected and honest.
                  The correct parallel target is route optimization → see Benchmark.
                </p>
              </div>
              <PerformanceChart />
              <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-500">Tick Rate</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-bold text-orange-400">
                    {metrics.tickRateHz === 0 ? '—' : String(metrics.tickRateHz)}
                  </span>
                  {metrics.tickRateHz > 0 && <span className="text-xs text-gray-600">Hz</span>}
                </div>
                <p className="mt-0.5 text-xs text-gray-600">simulation ticks / second</p>
              </div>
            </div>
          )}

          {activeTab === 'sync' && <SyncPanel />}

          {activeTab === 'events' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Chronological log of simulation events. Most recent first.
              </p>
              <EventTimeline />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
