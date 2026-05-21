'use client';

import { clsx } from 'clsx';
import { useSimulationStore } from '@/src/store/simulationStore';

const STATUS_MAP = {
  idle:    { label: 'Idle',    textColor: 'text-gray-500',   dotColor: 'bg-gray-600' },
  running: { label: 'Running', textColor: 'text-green-400',  dotColor: 'bg-green-400 animate-pulse' },
  paused:  { label: 'Paused',  textColor: 'text-yellow-400', dotColor: 'bg-yellow-400' },
  stopped: { label: 'Stopped', textColor: 'text-red-400',    dotColor: 'bg-red-500' },
} as const;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function StatusBar() {
  const { status, tick, elapsedMs } = useSimulationStore();
  const cfg = STATUS_MAP[status];

  return (
    <footer className="flex h-10 shrink-0 items-center justify-between border-t border-gray-800 bg-gray-900 px-6 text-xs">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dotColor)} />
          <span className={cfg.textColor}>Simulation: {cfg.label}</span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
          <span>WS: Disconnected</span>
        </div>
      </div>

      <div className="flex items-center gap-6 font-mono text-gray-500">
        <span>Tick: {tick.toLocaleString()}</span>
        <span>Rate: — Hz</span>
        <span>Elapsed: {formatElapsed(elapsedMs)}</span>
      </div>
    </footer>
  );
}
