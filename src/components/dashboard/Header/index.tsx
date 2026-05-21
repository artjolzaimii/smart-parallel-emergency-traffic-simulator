'use client';

import { clsx } from 'clsx';
import { Cpu, Radio } from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { useSimulationStore } from '@/src/store/simulationStore';
import { useWsStore } from '@/src/store/wsStore';

const WS_STATUS_CONFIG = {
  connected:    { dot: 'bg-green-400 animate-pulse', text: 'text-green-400', label: 'Connected' },
  connecting:   { dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', label: 'Connecting…' },
  disconnected: { dot: 'bg-gray-600', text: 'text-gray-500', label: 'Disconnected' },
  error:        { dot: 'bg-red-500', text: 'text-red-400', label: 'Error' },
} as const;

export function Header() {
  const { config } = useSimulationStore();
  const wsStatus = useWsStore((s) => s.status);
  const ws = WS_STATUS_CONFIG[wsStatus];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-6">
      {/* Branding */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-cyan-800 bg-cyan-950">
          <Cpu className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-widest text-gray-100">SPERTS</h1>
          <p className="text-xs text-gray-500">
            Smart Parallel Emergency &amp; Traffic Simulator
          </p>
        </div>
      </div>

      {/* WS connection status */}
      <div className="flex items-center gap-2 text-xs">
        <Radio className="h-3.5 w-3.5 text-gray-600" />
        <span className={clsx('flex items-center gap-1.5', ws.text)}>
          <span className={clsx('h-2 w-2 rounded-full', ws.dot)} />
          {ws.label} — ws://localhost:3001
        </span>
      </div>

      {/* Mode badge */}
      <Badge
        variant={config.mode === 'parallel' ? 'info' : 'neutral'}
        label={config.mode === 'parallel' ? 'Parallel Mode' : 'Sequential Mode'}
        dot
      />
    </header>
  );
}
