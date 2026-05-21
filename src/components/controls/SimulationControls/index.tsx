'use client';

import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useSimulationStore } from '@/src/store/simulationStore';

export function SimulationControls() {
  const { status, setStatus, reset } = useSimulationStore();

  const isRunning = status === 'running';
  const isPaused  = status === 'paused';
  const isIdle    = status === 'idle';

  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={isRunning}
        onClick={() => setStatus('running')}
      >
        <Play className="h-4 w-4" />
        Start Simulation
      </Button>

      <Button
        variant={isPaused ? 'warning' : 'secondary'}
        size="md"
        fullWidth
        disabled={isIdle}
        onClick={() => setStatus(isPaused ? 'running' : 'paused')}
      >
        <Pause className="h-4 w-4" />
        {isPaused ? 'Resume' : 'Pause'}
      </Button>

      <Button
        variant="ghost"
        size="md"
        fullWidth
        disabled={isIdle}
        onClick={reset}
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
    </div>
  );
}
