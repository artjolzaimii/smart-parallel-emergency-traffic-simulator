import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { SimulationEngine } from '../src/simulation/engine/SimulationEngine';
import { AppWebSocketServer } from '../src/websocket/WebSocketServer';

const PORT = 3001;

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

const engine = new SimulationEngine();
const wsServer = new AppWebSocketServer(wss, engine);

wsServer.start();

httpServer.listen(PORT, () => {
  console.log(`[Server] Simulation WS server listening on ws://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('[Server] Shutting down…');
  engine.shutdown();
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  engine.shutdown();
  httpServer.close(() => process.exit(0));
});
