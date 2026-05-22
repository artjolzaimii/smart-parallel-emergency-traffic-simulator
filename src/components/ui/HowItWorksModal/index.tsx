'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Cpu, Siren, AlertTriangle, RefreshCw, ChevronRight, Map } from 'lucide-react';

const DEMO_STEPS = [
  {
    n: 1,
    title: 'Choose vehicle count',
    detail: 'Set 50–200 vehicles. Each one starts on a real Tirana road edge and moves along the network.',
  },
  {
    n: 2,
    title: 'Start simulation',
    detail: 'Click Start Simulation. Vehicles begin moving along road edges. Traffic lights cycle. Congestion evolves dynamically.',
  },
  {
    n: 3,
    title: 'Switch Sequential ↔ Parallel',
    detail: 'Toggle execution mode. The Performance chart shows computation time per tick. Parallel mode uses 4 worker threads to move all vehicles simultaneously.',
  },
  {
    n: 4,
    title: 'Trigger Emergency',
    detail: 'Activates the ambulance and runs A* pathfinding from Skanderbeg Square to QSUT Hospital. The route polyline now follows real roads. ETA appears in Emergency Routing.',
  },
  {
    n: 5,
    title: 'Create Incident',
    detail: 'Adds a random accident/blockage to a road edge. Watch congestion rise and Route Quality drop. If degradation exceeds 25%, auto-rerouting picks a new path.',
  },
  {
    n: 6,
    title: 'Observe rerouting & metrics',
    detail: 'The Reroutes counter increments, the route polyline changes, and TL Priority turns lights green along the new path. Compare Sequential vs Parallel routing times.',
  },
];

const HOW_IT_WORKS = [
  {
    icon: Map,
    title: 'Road data',
    text: "OpenStreetMap roads are fetched via the Overpass API and cached as data/roads/tirana-road-graph.json. The app reads this file at startup — no network calls at runtime. Run npm run generate:roads to refresh the cache.",
  },
  {
    icon: Cpu,
    title: 'Vehicle movement',
    text: "Each vehicle holds a currentEdgeId and progress (0→1). Every tick, it advances by speed/edgeLength and interpolates its lat/lng along the edge's coordinate array. On reaching the far node it picks the next edge from the adjacency map.",
  },
  {
    icon: Siren,
    title: 'Emergency routing',
    text: 'A* pathfinding runs over the same graph. In parallel mode, four worker threads each evaluate a different strategy (standard, avoid-congestion, avoid-blocked, prefer-speed) simultaneously. The best result wins.',
  },
  {
    icon: AlertTriangle,
    title: 'Incidents',
    text: 'Incidents attach to graph edges and inject a congestion boost (or blocked flag) into the pathfinding cost function. The route cost monitor checks every 8 ticks and reroutes if cost rises by >25%.',
  },
  {
    icon: RefreshCw,
    title: 'Fallback',
    text: 'If tirana-road-graph.json does not exist, the engine falls back to a handcrafted 16-node mock graph so the simulation always works.',
  },
];

interface Props {
  onClose: () => void;
}

export function HowItWorksModal({ onClose }: Props) {
  // Avoid rendering portal during SSR (document.body doesn't exist server-side)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Prevent the page beneath from scrolling while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  const content = (
    /*
     * Rendered via createPortal into document.body so it sits completely outside
     * the React tree's DOM hierarchy — no parent stacking context (overflow:hidden,
     * transform, filter, will-change) can clip or occlude it.
     * z-[9999] keeps the backdrop above Leaflet's highest pane (z-700 tooltip),
     * and the panel itself is one layer higher.
     */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-base font-bold tracking-widest text-gray-100">
          How SPERTS Works
        </h2>
        <p className="mb-6 text-xs text-gray-500">
          Smart Parallel Emergency &amp; Traffic Simulator — road-graph overview &amp; demo guide
        </p>

        <div className="mb-6 space-y-4">
          {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <div className="mt-0.5 shrink-0 rounded border border-gray-700 bg-gray-800 p-1.5">
                <Icon className="h-3.5 w-3.5 text-cyan-400" />
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold text-gray-200">{title}</p>
                <p className="text-xs leading-relaxed text-gray-500">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <hr className="mb-5 border-gray-800" />

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
          Demo Steps
        </h3>
        <div className="space-y-2">
          {DEMO_STEPS.map(({ n, title, detail }) => (
            <div key={n} className="flex gap-3 rounded border border-gray-800 bg-gray-950 p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-xs font-bold text-cyan-400">
                {n}
              </span>
              <div>
                <div className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-gray-200">
                  <ChevronRight className="h-3 w-3 text-cyan-600" />
                  {title}
                </div>
                <p className="text-xs leading-relaxed text-gray-600">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-center text-xs text-gray-700">
          Press Esc or click outside to close
        </p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
