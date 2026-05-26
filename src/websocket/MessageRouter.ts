import type { WebSocket } from 'ws';
import type { SimulationEngine } from '../simulation/engine/SimulationEngine';
import type { BroadcastManager } from './BroadcastManager';
import type { SimulationMode, SimulationScenario } from '../types/simulation';
import type { BenchmarkMode } from '../types/benchmark';
import type { AdvantageWorkload } from '../types/emergency';

interface ClientMessage {
  type: string;
  payload?: Record<string, unknown>;
}

export class MessageRouter {
  constructor(
    private engine: SimulationEngine,
    private broadcast: BroadcastManager,
  ) {}

  handle(msg: ClientMessage, _ws: WebSocket): void {
    switch (msg.type) {
      case 'START_SIMULATION':
        this.engine.start();
        break;
      case 'PAUSE_SIMULATION':
        this.engine.pause();
        break;
      case 'RESET_SIMULATION':
        this.engine.reset();
        break;
      case 'SET_MODE':
        this.engine.updateConfig({ mode: msg.payload?.mode as SimulationMode });
        break;
      case 'SET_SPEED':
        this.engine.updateConfig({ speed: Number(msg.payload?.speed ?? 1) });
        break;
      case 'SET_VEHICLE_COUNT':
        this.engine.updateConfig({ vehicleCount: Number(msg.payload?.vehicleCount ?? 50) });
        break;
      case 'SET_SCENARIO':
        this.engine.updateConfig({ scenario: msg.payload?.scenario as SimulationScenario });
        break;
      case 'TOGGLE_COMPARE_MODE':
        // Legacy: now a no-op; use RUN_PARALLEL_ADVANTAGE_SCENARIO instead
        this.engine.toggleCompareMode();
        break;
      case 'TRIGGER_EMERGENCY':
        this.engine.triggerEmergency();
        break;
      case 'CREATE_INCIDENT':
        this.engine.createManualIncident();
        break;
      case 'TOGGLE_AUTO_REROUTE':
        this.engine.toggleAutoReroute();
        break;
      case 'TOGGLE_EMERGENCY_PRIORITY':
        this.engine.toggleEmergencyPriority();
        break;
      case 'RUN_PARALLEL_ADVANTAGE_SCENARIO': {
        const workload = (msg.payload?.workload as AdvantageWorkload | undefined) ?? 'heavy';
        void this.engine.runParallelAdvantageScenario(workload);
        break;
      }
      case 'RUN_BENCHMARK':
        void this.engine.runBenchmark(
          Number(msg.payload?.candidateCount ?? 100),
          Number(msg.payload?.iterationCount ?? 3),
          (msg.payload?.mode as BenchmarkMode) ?? 'comparison',
        );
        break;
      default:
        console.warn('[WS] Unknown message type:', msg.type);
    }
  }
}
