'use client';

import { type ReactNode, useState } from 'react';
import { clsx } from 'clsx';
import { Siren, Layers, AlertTriangle, RefreshCw, Zap, Play } from 'lucide-react';
import type { AdvantageWorkload } from '@/src/types/emergency';
import { Button } from '@/src/components/ui/Button';
import { SimulationControls } from '@/src/components/controls/SimulationControls';
import { SpeedSlider } from '@/src/components/controls/SpeedSlider';
import { ScenarioSelector } from '@/src/components/controls/ScenarioSelector';
import { useSimulationStore } from '@/src/store/simulationStore';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import { wsService } from '@/src/services/websocketService';
import type { SimulationMode } from '@/src/types/simulation';

const VEHICLE_COUNTS = [10, 25, 50, 100, 200, 500];

const WORKLOAD_OPTIONS: { value: AdvantageWorkload; label: string; candidates: number; desc: string }[] = [
  { value: 'standard', label: 'Standard', candidates: 500,  desc: '2 000 A* evals' },
  { value: 'heavy',    label: 'Heavy',    candidates: 1000, desc: '4 000 A* evals' },
  { value: 'extreme',  label: 'Extreme',  candidates: 2000, desc: '8 000 A* evals' },
];

export function Sidebar() {
  const { config } = useSimulationStore();
  const autoRerouteEnabled      = useEmergencyStore((s) => s.autoRerouteEnabled);
  const priorityEnabled         = useEmergencyStore((s) => s.emergencyPriorityEnabled);
  const emergencyActive         = useEmergencyStore((s) => s.emergencyActive);
  const parallelAdvantageActive = useEmergencyStore((s) => s.parallelAdvantageActive);

  const [selectedWorkload, setSelectedWorkload] = useState<AdvantageWorkload>('heavy');

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-800 bg-gray-900">
      <div className="flex-1 space-y-5 p-4">

        <Section icon={<Layers className="h-3.5 w-3.5" />} label="Simulation">
          <SimulationControls />
        </Section>

        <Divider />

        <Section label="Parameters">
          <div className="space-y-4">
            <SpeedSlider />

            <div>
              <label className="mb-1.5 block text-xs text-gray-400">
                Vehicle Count
              </label>
              <select
                value={config.vehicleCount}
                onChange={(e) =>
                  wsService.send('SET_VEHICLE_COUNT', { vehicleCount: Number(e.target.value) })
                }
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:border-cyan-600 focus:outline-none"
              >
                {VEHICLE_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} vehicles
                  </option>
                ))}
              </select>
            </div>

            <ScenarioSelector />
          </div>
        </Section>

        <Divider />

        <Section label="Execution Mode">
          <div className="flex gap-2">
            <ModeButton
              label="Parallel"
              active={config.mode === 'parallel'}
              onClick={() => wsService.send('SET_MODE', { mode: 'parallel' as SimulationMode })}
            />
            <ModeButton
              label="Sequential"
              active={config.mode === 'sequential'}
              onClick={() => wsService.send('SET_MODE', { mode: 'sequential' as SimulationMode })}
            />
          </div>
        </Section>

        <Divider />

        <Section label="Emergency">
          <div className="space-y-2">
            <Button
              variant="danger"
              size="md"
              fullWidth
              disabled={emergencyActive || parallelAdvantageActive}
              onClick={() => wsService.send('TRIGGER_EMERGENCY')}
            >
              <Siren className="h-4 w-4" />
              Trigger Emergency
            </Button>

            <p className="rounded border border-gray-800 bg-gray-950/50 px-2 py-1.5 text-xs text-gray-600 leading-relaxed">
              Single ambulance. Computes both{' '}
              <span className="text-blue-400 font-medium">sequential</span> and{' '}
              <span className="text-cyan-400 font-medium">parallel</span> routes.
              Dispatcher Comparison panel appears in metrics.
            </p>

            <Button
              variant="secondary"
              size="md"
              fullWidth
              disabled={emergencyActive || parallelAdvantageActive}
              onClick={() => wsService.send('CREATE_INCIDENT')}
            >
              <AlertTriangle className="h-4 w-4" />
              Create Incident
            </Button>
          </div>
        </Section>

        <Divider />

        <Section label="Parallel Advantage">
          <div className="space-y-2">
            {/* Workload selector */}
            <div>
              <p className="mb-1.5 text-xs text-gray-500">Workload (candidates × 4 strategies)</p>
              <div className="flex gap-1">
                {WORKLOAD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    disabled={parallelAdvantageActive}
                    onClick={() => setSelectedWorkload(opt.value)}
                    className={clsx(
                      'flex-1 rounded border px-1 py-1.5 text-center transition-colors duration-150',
                      selectedWorkload === opt.value
                        ? 'border-cyan-700 bg-cyan-950 text-cyan-300'
                        : 'border-gray-700 bg-transparent text-gray-500 hover:border-gray-600 hover:text-gray-400',
                      parallelAdvantageActive && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              fullWidth
              disabled={parallelAdvantageActive}
              onClick={() => wsService.send('RUN_PARALLEL_ADVANTAGE_SCENARIO', { workload: selectedWorkload })}
            >
              <Play className="h-4 w-4" />
              {parallelAdvantageActive ? 'Scenario Running…' : 'Run Parallel Advantage Scenario'}
            </Button>

            <div className="rounded border border-cyan-900 bg-cyan-950/20 px-2 py-2 space-y-1">
              <p className="text-xs font-semibold text-cyan-400">How it works</p>
              <ul className="space-y-0.5 text-xs text-gray-500">
                <li>→ <span className="text-blue-400 font-medium">SEQ</span>: all A* evals run in one thread</li>
                <li>→ <span className="text-cyan-400 font-medium">PAR</span>: same evals split across 4 persistent workers</li>
                <li>→ Both ambulances drive at <span className="text-gray-300">identical speed</span></li>
                <li>→ PAR starts sooner — parallel computation finishes first</li>
              </ul>
            </div>
          </div>
        </Section>

        <Divider />

        <Section label="Response">
          <div className="space-y-2">
            <ToggleButton
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              label="Auto-reroute"
              active={autoRerouteEnabled}
              onClick={() => wsService.send('TOGGLE_AUTO_REROUTE')}
            />
            <ToggleButton
              icon={<Zap className="h-3.5 w-3.5" />}
              label="TL Priority"
              active={priorityEnabled}
              onClick={() => wsService.send('TOGGLE_EMERGENCY_PRIORITY')}
            />
          </div>
        </Section>

      </div>
    </aside>
  );
}

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
        {icon}
        {label}
      </h3>
      {children}
    </section>
  );
}

function Divider() {
  return <hr className="border-gray-800" />;
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 rounded border py-1.5 text-xs font-medium transition-colors duration-150',
        active
          ? 'border-cyan-700 bg-cyan-950 text-cyan-400'
          : 'border-gray-700 bg-transparent text-gray-500 hover:border-gray-600 hover:text-gray-400',
      )}
    >
      {label}
    </button>
  );
}

function ToggleButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2 rounded border px-3 py-2 text-xs font-medium transition-colors duration-150',
        active
          ? 'border-cyan-800 bg-cyan-950 text-cyan-400'
          : 'border-gray-700 bg-transparent text-gray-500 hover:border-gray-600 hover:text-gray-400',
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span
        className={clsx(
          'rounded px-1.5 py-0.5 text-xs',
          active ? 'bg-cyan-900 text-cyan-300' : 'bg-gray-800 text-gray-600',
        )}
      >
        {active ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
