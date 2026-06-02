'use client';

import { useSimulationStore } from '@/src/store/simulationStore';
import { wsService } from '@/src/services/websocketService';
import type { SimulationScenario } from '@/src/types/simulation';

const SCENARIOS: { value: SimulationScenario; label: string }[] = [
  { value: 'morning-rush',       label: 'Morning Rush (High Congestion)' },
  { value: 'evening-rush',       label: 'Evening Rush (Peak Congestion)' },
  { value: 'emergency-incident', label: 'Emergency Mode (Auto-Dispatch)' },
  { value: 'night-low',          label: 'Night Drive (Low Congestion)' },
];

export function ScenarioSelector() {
  const { config } = useSimulationStore();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    wsService.send('SET_SCENARIO', { scenario: e.target.value as SimulationScenario });
  }

  return (
    <div>
      <label className="mb-1 block text-xs text-gray-400">Traffic Pattern</label>
      <select
        value={config.scenario}
        onChange={handleChange}
        className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-cyan-600 focus:outline-none"
      >
        {SCENARIOS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-700">Changes congestion level and emergency behavior</p>
    </div>
  );
}
