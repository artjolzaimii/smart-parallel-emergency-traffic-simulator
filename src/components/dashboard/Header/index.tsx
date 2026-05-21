'use client';

import { Cpu, Radio } from 'lucide-react';
import { Badge } from '@/src/components/ui/Badge';
import { useSimulationStore } from '@/src/store/simulationStore';

export function Header() {
  const { config } = useSimulationStore();
  const mode = config.mode;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-6">
      {/* Branding */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-cyan-800 bg-cyan-950">
          <Cpu className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-widest text-gray-100">
            SPERTS
          </h1>
          <p className="text-xs text-gray-500">
            Smart Parallel Emergency &amp; Traffic Simulator
          </p>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Radio className="h-3.5 w-3.5 text-gray-600" />
        <span className="h-2 w-2 rounded-full bg-gray-600" />
        <span>Disconnected — ws://localhost:3001</span>
      </div>

      {/* Mode badge */}
      <Badge
        variant={mode === 'parallel' ? 'info' : 'neutral'}
        label={mode === 'parallel' ? 'Parallel Mode' : 'Sequential Mode'}
        dot
      />
    </header>
  );
}
