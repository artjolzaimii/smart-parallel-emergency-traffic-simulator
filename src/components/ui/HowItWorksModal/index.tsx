'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Cpu, Siren, AlertTriangle, RefreshCw, ChevronRight, Map, BarChart2, Zap } from 'lucide-react';

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
    detail: 'Toggle execution mode. Vehicle coordinate updates are lightweight — IPC overhead often dominates in parallel mode. This is honest and expected. The Live Tick Cost chart is in Advanced Diagnostics (collapsed by default at the bottom of the metrics panel). The correct parallel target is route optimization — see the Benchmark.',
  },
  {
    n: 4,
    title: 'Trigger Emergency (normal mode)',
    detail: 'Activates one ambulance from the Lake Park area (NW) to QSUT Hospital (NE). Both sequential and parallel dispatchers compute routes simultaneously. The Dispatcher Comparison panel shows both compute times — one ambulance follows the parallel route (best of 4 strategies).',
  },
  {
    n: 5,
    title: 'Create Incident',
    detail: 'Adds a random accident/blockage to a road edge. Watch congestion rise and Route Quality drop. If degradation exceeds 25%, auto-rerouting triggers. Both seq and par reroute compute times are shown in the comparison panel.',
  },
  {
    n: 6,
    title: 'Run Visual Parallel Demo',
    detail: 'Click "Run Visual Parallel Demo" in the sidebar. Two ambulances appear (SEQ blue, PAR cyan). Each waits at the station while its dispatcher computes the route. Because PAR finishes computing sooner, it starts moving sooner. Both ambulances drive at identical speed — PAR only gains advantage from faster computation. Results appear in the Parallel Advantage Summary panel on the right.',
  },
  {
    n: 7,
    title: 'Run the Benchmark (Primary Parallel Proof)',
    detail: 'Find the Benchmark section in the right metrics panel, labeled "Primary Parallel Proof". Select candidate count and iterations, then Run Comparison. This is where parallel programming genuinely pays off: batch route optimization is compute-heavy and embarrassingly parallel. Watch sequential vs parallel timings, speedup, and efficiency.',
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
    text: "Each vehicle holds a currentEdgeId and progress (0→1). Every tick, it advances by speed/edgeLength and interpolates its lat/lng along the edge's coordinate array. This is a lightweight operation — moving one vehicle takes ~0.01 ms. Splitting it across worker threads adds IPC serialization overhead that exceeds the compute savings. The Live Tick Cost panel shows this honestly.",
  },
  {
    icon: Siren,
    title: 'Emergency routing',
    text: 'A* pathfinding runs over the OSM graph from the Lake Park dispatch point to QSUT Hospital. In parallel mode, four worker threads each evaluate a different route strategy (standard, avoid-congestion, avoid-blocked, prefer-speed) simultaneously. The best result wins. This IS a good use of parallelism — each A* evaluation is independent and CPU-bound.',
  },
  {
    icon: Zap,
    title: 'Why parallelism helps dispatch — not driving',
    text: 'Parallel programming does NOT make an ambulance drive faster. Physical travel time depends on road distance, congestion, and vehicle speed — not computation speed. What parallelism improves is the dispatch system: faster route calculation, faster rerouting after incidents, faster evaluation of multiple route strategies, and faster decision-making under heavy traffic. The ambulance benefits from starting sooner because the route was computed faster.',
  },
  {
    icon: AlertTriangle,
    title: 'Parallel Advantage Scenario — honest mechanics',
    text: 'Both SEQ and PAR ambulances drive at exactly the same physical speed. SEQ uses one A* in the main thread (fast for simple cases, slower under heavy load). PAR uses 4 workers running 4 strategies × 4 candidates simultaneously. The dispatch delay for each ambulance is proportional to its route computation time: 5 ms of compute = 1 tick of ambulance wait. Displayed compute times are real measured wall-clock values.',
  },
  {
    icon: BarChart2,
    title: 'Benchmark (primary parallel proof)',
    text: 'The dedicated Benchmark panel evaluates batches of N random route candidate pairs, each under all 4 strategies (4 A* calls per candidate). Sequential scores them one-by-one; parallel splits the batch across 4 persistent workers. For 100–500 candidates on the OSM graph (~2 000 nodes), parallel shows genuine speedup — this is the correct workload for demonstrating parallelism.',
  },
  {
    icon: RefreshCw,
    title: 'Fallback',
    text: 'If tirana-road-graph.json does not exist, the engine falls back to a handcrafted 18-node mock graph so the simulation always works. On the mock graph the benchmark workload is trivially fast (16-node A* ≈ 0.01 ms) and IPC overhead dominates — run npm run generate:roads for meaningful parallel speedup measurements.',
  },
];

interface Props {
  onClose: () => void;
}

export function HowItWorksModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
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

        {/* Key parallel insight callout */}
        <div className="mb-6 rounded-lg border border-cyan-900 bg-cyan-950/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-cyan-400">
            What parallel programming actually improves
          </p>
          <p className="text-xs leading-relaxed text-gray-400">
            Parallelism does <span className="text-white font-semibold">not</span> make the ambulance drive faster.
            It makes the <span className="text-cyan-300">dispatch system compute routes faster</span> — evaluating
            multiple strategies simultaneously in worker threads. The ambulance benefits because the dispatcher
            finishes computing sooner, so the ambulance can start moving sooner.
          </p>
          <p className="text-xs leading-relaxed text-gray-500">
            Vehicle coordinate updates are too lightweight — IPC overhead exceeds the compute cost,
            so the live tick panel often shows parallel mode as slower. That is honest and expected.
            The correct parallel target is <span className="text-cyan-300">route optimization</span>:
            scoring many independent A* candidate paths is CPU-bound, embarrassingly parallel, and
            shows genuine speedup in the Benchmark and Parallel Advantage Scenario.
          </p>
        </div>

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
