import type { WebSocket } from 'ws';
import type { SimulationEngine } from '../simulation/engine/SimulationEngine';
import type { BroadcastManager } from './BroadcastManager';
import type { SimulationMode, SimulationScenario } from '../types/simulation';

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
      case 'TRIGGER_EMERGENCY':
        this.engine.triggerEmergency();
        break;
      default:
        console.warn('[WS] Unknown message type:', msg.type);
    }
  }
}
