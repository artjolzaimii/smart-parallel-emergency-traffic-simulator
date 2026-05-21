'use client';

import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { useSimulationStore } from '@/src/store/simulationStore';
import { useWsStore } from '@/src/store/wsStore';
import { wsService } from '@/src/services/websocketService';

export function SimulationControls() {
  const status = useSimulationStore((s) => s.status);
  const wsConnected = useWsStore((s) => s.status === 'connected');

  const isRunning = status === 'running';
  const isIdle    = status === 'idle';

  return (
    <div className="space-y-2">
      {/* Start when idle, Resume when paused — disabled while actively running */}
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

      {/* Pause — only active while the simulation is running */}
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
