'use client';

import { clsx } from 'clsx';
import { useState } from 'react';
import { Siren, AlertTriangle, Play, RefreshCw, Zap } from 'lucide-react';
import type { AdvantageWorkload } from '@/src/types/emergency';
import { SimulationControls } from '@/src/components/controls/SimulationControls';
import { useSimulationStore } from '@/src/store/simulationStore';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import { wsService } from '@/src/services/websocketService';
import type { SimulationMode, SimulationScenario } from '@/src/types/simulation';

const VEHICLE_COUNTS = [10, 25, 50, 100, 200, 500];

const SCENARIOS: { value: SimulationScenario; label: string }[] = [
  { value: 'morning-rush',       label: 'Morning Rush' },
  { value: 'evening-rush',       label: 'Evening Rush' },
  { value: 'emergency-incident', label: 'Emergency Mode' },
  { value: 'night-low',          label: 'Night — Low' },
];

const WORKLOAD_OPTIONS: { value: AdvantageWorkload; label: string; desc: string }[] = [
  { value: 'standard', label: 'Std',   desc: '2k' },
  { value: 'heavy',    label: 'Heavy', desc: '4k' },
  { value: 'extreme',  label: 'Max',   desc: '8k' },
];

const SELECT_CLS =
  'w-full rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-xs text-gray-200 focus:border-cyan-600 focus:outline-none';

export function Sidebar() {
  const { config }              = useSimulationStore();
  const autoRerouteEnabled      = useEmergencyStore((s) => s.autoRerouteEnabled);
  const priorityEnabled         = useEmergencyStore((s) => s.emergencyPriorityEnabled);
  const emergencyActive         = useEmergencyStore((s) => s.emergencyActive);
  const parallelAdvantageActive = useEmergencyStore((s) => s.parallelAdvantageActive);

  const [selectedWorkload, setSelectedWorkload] = useState<AdvantageWorkload>('heavy');

  const emergencyLocked = emergencyActive || parallelAdvantageActive;

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-2.5 overflow-hidden border-r border-gray-800 bg-gray-900 p-3">

      {/* ── SIMULATION CONTROLS ──────────────────────────── */}
      <SimulationControls compact />

      {/* ── SPEED ────────────────────────────────────────── */}
      <div>
        <label className="mb-1 block text-xs text-gray-600">
          Speed&nbsp;
          <span className="font-mono text-gray-400">{config.speed}×</span>
        </label>
        <div className="flex gap-1">
          {([1, 3, 5, 10] as const).map((s) => (
            <button
              key={s}
              onClick={() => wsService.send('SET_SPEED', { speed: s })}
              className={clsx(
                'flex-1 rounded border py-1.5 text-xs font-semibold transition-colors',
                config.speed === s
                  ? 'border-cyan-700 bg-cyan-950 text-cyan-300'
                  : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400',
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* ── PARAMETERS: vehicle count + traffic pattern ── */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Vehicles</label>
          <select
            value={config.vehicleCount}
            onChange={(e) => wsService.send('SET_VEHICLE_COUNT', { vehicleCount: Number(e.target.value) })}
            className={SELECT_CLS}
          >
            {VEHICLE_COUNTS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Pattern</label>
          <select
            value={config.scenario}
            onChange={(e) => wsService.send('SET_SCENARIO', { scenario: e.target.value as SimulationScenario })}
            className={SELECT_CLS}
          >
            {SCENARIOS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── EXECUTION MODE ────────────────────────────────── */}
      <div className="flex gap-1">
        <ModeBtn
          label="Parallel"
          active={config.mode === 'parallel'}
          onClick={() => wsService.send('SET_MODE', { mode: 'parallel' as SimulationMode })}
        />
        <ModeBtn
          label="Sequential"
          active={config.mode === 'sequential'}
          onClick={() => wsService.send('SET_MODE', { mode: 'sequential' as SimulationMode })}
        />
      </div>

      <Divider />

      {/* ── EMERGENCY ────────────────────────────────────── */}
      <ActionBtn
        disabled={emergencyLocked}
        onClick={() => wsService.send('TRIGGER_EMERGENCY')}
        icon={<Siren className="h-3.5 w-3.5 shrink-0" />}
        label="Trigger Emergency"
        colorClass={emergencyLocked
          ? 'border-gray-800 text-gray-600'
          : 'border-red-800 bg-red-950/30 text-red-300 hover:bg-red-950/60'}
      />
      <ActionBtn
        disabled={emergencyLocked}
        onClick={() => wsService.send('CREATE_INCIDENT')}
        icon={<AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
        label="Create Incident"
        colorClass={emergencyLocked
          ? 'border-gray-800 text-gray-600'
          : 'border-orange-800 bg-orange-950/20 text-orange-300 hover:bg-orange-950/50'}
      />

      <Divider />

      {/* ── VISUAL PARALLEL DEMO ─────────────────────────── */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        Visual Parallel Demo
      </p>

      {/* Workload selector */}
      <div className="flex gap-1">
        {WORKLOAD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={parallelAdvantageActive}
            onClick={() => setSelectedWorkload(opt.value)}
            className={clsx(
              'flex-1 rounded border py-1 text-center text-xs transition-colors',
              selectedWorkload === opt.value
                ? 'border-cyan-700 bg-cyan-950 text-cyan-300'
                : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400',
              parallelAdvantageActive && 'cursor-not-allowed opacity-50',
            )}
          >
            <div className="font-semibold leading-tight">{opt.label}</div>
            <div className="opacity-60">{opt.desc}</div>
          </button>
        ))}
      </div>

      <ActionBtn
        disabled={parallelAdvantageActive}
        onClick={() => wsService.send('RUN_PARALLEL_ADVANTAGE_SCENARIO', { workload: selectedWorkload })}
        icon={<Play className="h-3.5 w-3.5 shrink-0" />}
        label={parallelAdvantageActive ? 'Running…' : 'Run Visual Parallel Demo'}
        colorClass={parallelAdvantageActive
          ? 'border-gray-800 text-gray-600'
          : 'border-cyan-700 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-950/70'}
      />

      <Divider />

      {/* ── RESPONSE TOGGLES ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-1.5">
        <CompactToggle
          icon={<RefreshCw className="h-3 w-3" />}
          label="Auto-reroute"
          active={autoRerouteEnabled}
          onClick={() => wsService.send('TOGGLE_AUTO_REROUTE')}
        />
        <CompactToggle
          icon={<Zap className="h-3 w-3" />}
          label="TL Priority"
          active={priorityEnabled}
          onClick={() => wsService.send('TOGGLE_EMERGENCY_PRIORITY')}
        />
      </div>

    </aside>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Divider() {
  return <hr className="border-gray-800" />;
}

function ModeBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex-1 rounded border py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-cyan-700 bg-cyan-950 text-cyan-400'
          : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400',
      )}
    >
      {label}
    </button>
  );
}

function ActionBtn({
  disabled, onClick, icon, label, colorClass,
}: {
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  colorClass: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-xs font-semibold transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        colorClass,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function CompactToggle({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex flex-col items-center gap-0.5 rounded border px-1 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-cyan-800 bg-cyan-950 text-cyan-400'
          : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400',
      )}
    >
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={clsx(
        'rounded px-1 py-px text-xs leading-none',
        active ? 'bg-cyan-900 text-cyan-300' : 'bg-gray-800 text-gray-600',
      )}>
        {active ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
