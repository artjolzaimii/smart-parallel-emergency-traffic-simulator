'use client';

import { useSimulationStore } from '@/src/store/simulationStore';
import { wsService } from '@/src/services/websocketService';

export function SpeedSlider() {
  const { config } = useSimulationStore();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const speed = Number(e.target.value);
    wsService.send('SET_SPEED', { speed });
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs text-gray-400">Simulation Speed</label>
        <span className="font-mono text-xs font-semibold text-cyan-400">
          {config.speed}×
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={config.speed}
        onChange={handleChange}
        className="w-full cursor-pointer accent-cyan-500"
      />
      <div className="mt-1 flex justify-between text-xs text-gray-600">
        <span>1×</span>
        <span>5×</span>
        <span>10×</span>
      </div>
    </div>
  );
}
