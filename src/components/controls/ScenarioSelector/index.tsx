'use client';

import { useSimulationStore } from '@/src/store/simulationStore';
import { wsService } from '@/src/services/websocketService';
import type { SimulationScenario } from '@/src/types/simulation';

const SCENARIOS: { value: SimulationScenario; label: string }[] = [
  { value: 'morning-rush',       label: 'Morning Rush Hour' },
  { value: 'evening-rush',       label: 'Evening Rush Hour' },
  { value: 'emergency-incident', label: 'Emergency Incident' },
  { value: 'night-low',          label: 'Night — Low Traffic' },
];

export function ScenarioSelector() {
  const { config } = useSimulationStore();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    wsService.send('SET_SCENARIO', { scenario: e.target.value as SimulationScenario });
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs text-gray-400">Scenario</label>
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
    </div>
  );
}
