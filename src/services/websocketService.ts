import type { SimulationSnapshot } from '@/src/types/snapshot';
import { useSimulationStore } from '@/src/store/simulationStore';
import { useVehicleStore } from '@/src/store/vehicleStore';
import { useMetricsStore } from '@/src/store/metricsStore';
import { useWsStore } from '@/src/store/wsStore';

type SnapshotHandler = (snapshot: SimulationSnapshot) => void;

const WS_URL = 'ws://localhost:3001';
const RECONNECT_DELAY_MS = 3000;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers = new Set<SnapshotHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  connect(): void {
    if (this.ws) return;
    this.intentionalClose = false;
    this.openSocket();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnect();
    this.ws?.close();
    this.ws = null;
  }

  send(type: string, payload?: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  onSnapshot(handler: SnapshotHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private openSocket(): void {
    useWsStore.getState().setStatus('connecting');

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to simulation server');
      useWsStore.getState().setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; payload: unknown };

        if (msg.type === 'SIMULATION_SNAPSHOT') {
          const snapshot = msg.payload as SimulationSnapshot;
          this.applySnapshot(snapshot);
          this.handlers.forEach((h) => h(snapshot));
        }
      } catch {
        console.error('[WS] Failed to parse message');
      }
    };

    ws.onclose = () => {
      this.ws = null;
      useWsStore.getState().setStatus('disconnected');
      if (!this.intentionalClose) this.scheduleReconnect();
    };

    ws.onerror = () => {
      useWsStore.getState().setStatus('error');
    };
  }

  private applySnapshot(snapshot: SimulationSnapshot): void {
    useSimulationStore.getState().setStatus(snapshot.status);
    useSimulationStore.getState().updateConfig(snapshot.config);
    useSimulationStore.getState().setTickAndElapsed(snapshot.tick, snapshot.elapsedMs);
    useVehicleStore.getState().setVehicles(snapshot.vehicles);
    useMetricsStore.getState().updateMetrics(snapshot.metrics);
    useMetricsStore.getState().setBenchmark(snapshot.benchmark);
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      console.log('[WS] Reconnecting…');
      this.openSocket();
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const wsService = new WebSocketService();
