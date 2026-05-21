'use client';

import { Map } from 'lucide-react';

export function SimulationMap() {
  return (
    <main className="relative flex-1 overflow-hidden bg-gray-950">
      {/* Dot-grid atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(6,182,212,0.9) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Road grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6,182,212,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Center placeholder */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-cyan-900/60 bg-gray-900/80 shadow-lg shadow-cyan-950/50">
            <Map className="h-10 w-10 text-cyan-800" />
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm font-medium tracking-wide text-gray-400">
            Simulation Map Loading
          </p>
          <p className="mt-1 text-xs text-gray-600">
            React Leaflet renders here in Milestone 2
          </p>
        </div>

        <div className="rounded border border-gray-800 bg-gray-900/70 px-4 py-2 font-mono text-xs text-gray-500">
          48.8566° N, 2.3522° E — Paris, France
        </div>
      </div>

      {/* Top-left HUD */}
      <div className="absolute left-4 top-4 space-y-0.5 font-mono text-xs text-gray-700">
        <div>Engine: Idle</div>
        <div>Workers: 0 / 4</div>
      </div>

      {/* Bottom-right HUD */}
      <div className="absolute bottom-4 right-4 space-y-0.5 text-right font-mono text-xs text-gray-700">
        <div>Zoom: 13</div>
        <div>Tiles: OpenStreetMap</div>
        <div>Vehicles: 0 active</div>
      </div>
    </main>
  );
}
