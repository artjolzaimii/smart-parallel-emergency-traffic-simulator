import { WebSocketServer as WsServer, WebSocket } from 'ws';
import type { SimulationEngine } from '../simulation/engine/SimulationEngine';
import { BroadcastManager } from './BroadcastManager';
import { MessageRouter } from './MessageRouter';

export class AppWebSocketServer {
  private readonly broadcast: BroadcastManager;
  private readonly router: MessageRouter;

  constructor(
    private wss: WsServer,
    engine: SimulationEngine,
  ) {
    this.broadcast = new BroadcastManager(wss);
    this.router = new MessageRouter(engine, this.broadcast);

    engine.setOnSnapshot((snapshot) => {
      this.broadcast.broadcast({
        type: 'SIMULATION_SNAPSHOT',
        payload: snapshot,
        timestamp: Date.now(),
      });
    });
  }

  start(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log(`[WS] Client connected (total: ${this.broadcast.connectedCount})`);

      this.broadcast.sendTo(ws, {
        type: 'CONNECTION_STATUS',
        payload: { connected: true },
        timestamp: Date.now(),
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as {
            type: string;
            payload?: Record<string, unknown>;
          };
          this.router.handle(msg, ws);
        } catch {
          this.broadcast.sendTo(ws, {
            type: 'ERROR',
            payload: { message: 'Invalid message format' },
            timestamp: Date.now(),
          });
        }
      });

      ws.on('close', () => {
        console.log('[WS] Client disconnected');
      });

      ws.on('error', (err) => {
        console.error('[WS] Socket error:', err.message);
      });
    });

    console.log('[WS] WebSocket server ready');
  }
}
