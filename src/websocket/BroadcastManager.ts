import { WebSocketServer, WebSocket } from 'ws';

export interface ServerMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

export class BroadcastManager {
  constructor(private wss: WebSocketServer) {}

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  get connectedCount(): number {
    let n = 0;
    for (const c of this.wss.clients) {
      if (c.readyState === WebSocket.OPEN) n++;
    }
    return n;
  }
}
