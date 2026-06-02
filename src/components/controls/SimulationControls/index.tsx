'use client';

import { clsx } from 'clsx';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useSimulationStore } from '@/src/store/simulationStore';
import { useWsStore } from '@/src/store/wsStore';
import { wsService } from '@/src/services/websocketService';

interface Props {
  compact?: boolean;
}

export function SimulationControls({ compact = false }: Props) {
  const status      = useSimulationStore((s) => s.status);
  const wsConnected = useWsStore((s) => s.status === 'connected');

  const isRunning = status === 'running';
  const isIdle    = status === 'idle';

  if (compact) {
    return (
      <div className="flex gap-1">
        <InlineBtn
          disabled={!wsConnected || isRunning}
          onClick={() => wsService.send('START_SIMULATION')}
          className={clsx(
            'border-cyan-800 text-cyan-300 transition-colors',
            !wsConnected || isRunning
              ? 'cursor-not-allowed opacity-40'
              : 'bg-cyan-950/50 hover:bg-cyan-950/80',
          )}
          icon={<Play className="h-3.5 w-3.5" />}
          label={isIdle ? 'Start' : 'Resume'}
        />
        <InlineBtn
          disabled={!wsConnected || !isRunning}
          onClick={() => wsService.send('PAUSE_SIMULATION')}
          className={clsx(
            'border-gray-700 text-gray-400 transition-colors',
            !wsConnected || !isRunning
              ? 'cursor-not-allowed opacity-40'
              : 'hover:border-gray-600 hover:text-gray-300',
          )}
          icon={<Pause className="h-3.5 w-3.5" />}
          label="Pause"
        />
        <InlineBtn
          disabled={!wsConnected || isIdle}
          onClick={() => wsService.send('RESET_SIMULATION')}
          className={clsx(
            'border-gray-700 text-gray-500 transition-colors',
            !wsConnected || isIdle
              ? 'cursor-not-allowed opacity-40'
              : 'hover:border-gray-600 hover:text-gray-400',
          )}
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          label="Reset"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={!wsConnected || isRunning}
        onClick={() => wsService.send('START_SIMULATION')}
      >
        <Play className="h-4 w-4" />
        {isIdle ? 'Start Simulation' : 'Resume'}
      </Button>
      <Button
        variant="secondary"
        size="md"
        fullWidth
        disabled={!wsConnected || !isRunning}
        onClick={() => wsService.send('PAUSE_SIMULATION')}
      >
        <Pause className="h-4 w-4" />
        Pause
      </Button>
      <Button
        variant="ghost"
        size="md"
        fullWidth
        disabled={!wsConnected || isIdle}
        onClick={() => wsService.send('RESET_SIMULATION')}
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}

function InlineBtn({
  disabled, onClick, className, icon, label,
}: {
  disabled: boolean;
  onClick: () => void;
  className: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex flex-1 items-center justify-center gap-1 rounded border px-1 py-2 text-xs font-semibold',
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
