'use client';

import dynamic from 'next/dynamic';

const MapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: MapFallback,
});

export function SimulationMap() {
  return (
    <main className="relative min-w-0 flex-1 overflow-hidden bg-gray-950">
      <MapClient />
    </main>
  );
}

function MapFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-cyan-500" />
        <p className="font-mono text-xs text-gray-600">Loading map…</p>
      </div>
    </div>
  );
}
