import type { SimulationSnapshot } from '@/src/types/snapshot';
import { useSimulationStore } from '@/src/store/simulationStore';
import { useVehicleStore } from '@/src/store/vehicleStore';
import { useMetricsStore } from '@/src/store/metricsStore';
import { useWsStore } from '@/src/store/wsStore';
import { useEmergencyStore } from '@/src/store/emergencyStore';
import { useBenchmarkStore } from '@/src/store/benchmarkStore';

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
    useMetricsStore.getState().setRouting(snapshot.routingResult);
    const em = useEmergencyStore.getState();
    em.setIncidents(snapshot.incidents);
    em.setRerouteCount(snapshot.rerouteCount);
    em.setAutoReroute(snapshot.autoRerouteEnabled);
    em.setEmergencyPriority(snapshot.emergencyPriorityEnabled);
    em.setRouteQualityScore(snapshot.routeQualityScore);
    em.setEmergencyActive(snapshot.emergencyActive);
    em.setTrafficLightMarkers(snapshot.trafficLights);
    em.setEmergencyRoute(snapshot.emergencyRoute);
    em.setDispatchState(snapshot.dispatchState ?? null);
    em.setDispatcherComparison(snapshot.dispatcherComparison ?? null);
    em.setCompareEmergencyRoute(snapshot.compareEmergencyRoute ?? null);
    em.setNormalDispatchComparison(snapshot.normalDispatchComparison ?? null);
    em.setParallelAdvantageActive(snapshot.parallelAdvantageActive ?? false);
    em.setAdvantageWorkload(snapshot.advantageWorkload ?? null);
    useMetricsStore.getState().setSyncMetrics(snapshot.syncMetrics);

    const bm = useBenchmarkStore.getState();
    bm.setRunning(snapshot.benchmarkRunning);
    bm.setProgress(snapshot.benchmarkProgress);
    if (snapshot.fullBenchmarkResult) {
      const prev = bm.result;
      if (prev?.timestamp !== snapshot.fullBenchmarkResult.timestamp) {
        bm.setResult(snapshot.fullBenchmarkResult);
        bm.pushHistory(snapshot.fullBenchmarkResult);
      }
    }
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
