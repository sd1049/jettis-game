import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { WebSocketServer } from "ws";
import { DarknessRoomManager } from "./darknessRoom.js";
import { createPersistence, normalizeCode, type Persistence } from "./persistence.js";
import { RoomManager } from "./room.js";
import { serveStatic } from "./static.js";

export interface AppServer {
  httpServer: ReturnType<typeof createServer>;
  wsServer: WebSocketServer;
  darknessWsServer: WebSocketServer;
  persistence: Persistence;
  rooms: RoomManager;
  darknessRooms: DarknessRoomManager;
  start(port: number, host?: string): Promise<void>;
  stop(): Promise<void>;
}

export async function createAppServer(persistence = createPersistence()): Promise<AppServer> {
  await persistence.init();
  const rooms = new RoomManager(persistence);
  const darknessRooms = new DarknessRoomManager(persistence);
  const distDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

  const httpServer = createServer((req, res) => {
    void handleHttp(req, res, persistence, distDir);
  });
  const wsServer = new WebSocketServer({ noServer: true });
  const darknessWsServer = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/ws") {
      wsServer.handleUpgrade(req, socket, head, (webSocket) => {
        wsServer.emit("connection", webSocket, req);
      });
      return;
    }
    if (url.pathname === "/darkness-ws") {
      darknessWsServer.handleUpgrade(req, socket, head, (webSocket) => {
        darknessWsServer.emit("connection", webSocket, req);
      });
      return;
    }
    socket.destroy();
  });
  rooms.attach(wsServer);
  darknessRooms.attach(darknessWsServer);

  return {
    httpServer,
    wsServer,
    darknessWsServer,
    persistence,
    rooms,
    darknessRooms,
    async start(port: number, host = "127.0.0.1"): Promise<void> {
      rooms.start();
      darknessRooms.start();
      await new Promise<void>((resolveStart) => {
        httpServer.listen(port, host, () => resolveStart());
      });
    },
    async stop(): Promise<void> {
      rooms.stop();
      darknessRooms.stop();
      await new Promise<void>((resolveStop) => {
        wsServer.close(() => resolveStop());
      });
      await new Promise<void>((resolveStop) => {
        darknessWsServer.close(() => resolveStop());
      });
      await new Promise<void>((resolveStop) => {
        httpServer.close(() => resolveStop());
      });
    }
  };
}

async function handleHttp(
  req: IncomingMessage,
  res: ServerResponse,
  persistence: Persistence,
  distDir: string
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "jettis-game", time: new Date().toISOString() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/worlds") {
    const world = await persistence.createWorld();
    sendJson(res, 201, { code: world.code });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/darkness/worlds") {
    const world = await persistence.createDarknessWorld();
    sendJson(res, 201, { code: world.code });
    return;
  }

  const summaryMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/summary$/);
  if (req.method === "GET" && summaryMatch?.[1]) {
    const summary = await persistence.getWorldSummary(normalizeCode(summaryMatch[1]));
    if (!summary) {
      sendJson(res, 404, { error: "World not found." });
      return;
    }
    sendJson(res, 200, summary);
    return;
  }

  const darknessSummaryMatch = url.pathname.match(/^\/api\/darkness\/worlds\/([^/]+)\/summary$/);
  if (req.method === "GET" && darknessSummaryMatch?.[1]) {
    const summary = await persistence.getDarknessWorldSummary(normalizeCode(darknessSummaryMatch[1]));
    if (!summary) {
      sendJson(res, 404, { error: "Darkness world not found." });
      return;
    }
    sendJson(res, 200, summary);
    return;
  }

  if (serveStatic(req, res, distDir)) {
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(body));
}
