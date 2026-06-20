import { WebSocket, WebSocketServer } from "ws";
import {
  activateDarknessShield,
  addPlayerToDarknessWorld,
  applyDarknessInput,
  applyDarknessZap,
  buyDarknessHouse,
  parseDarknessClientMessage,
  serializeDarknessServerMessage,
  tickDarknessWorld,
  type DarknessClientMessage,
  type DarknessInputState,
  type DarknessServerMessage,
  type DarknessWorldState
} from "@jettis/shared";
import { createPlayerId } from "./ids.js";
import { normalizeCode, type Persistence } from "./persistence.js";

interface DarknessClientSession {
  socket: WebSocket;
  playerId?: string;
  worldCode?: string;
  lastInputAt: number;
}

interface DarknessRoom {
  world: DarknessWorldState;
  clients: Set<DarknessClientSession>;
  dirty: boolean;
  lastSavedAt: number;
}

export class DarknessRoomManager {
  private rooms = new Map<string, DarknessRoom>();
  private tickTimer?: NodeJS.Timeout;

  constructor(private persistence: Persistence) {}

  attach(server: WebSocketServer): void {
    server.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  start(): void {
    this.tickTimer = setInterval(() => {
      void this.tick();
    }, 1000);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }
  }

  async getOrLoadRoom(code: string): Promise<DarknessRoom | undefined> {
    const normalized = normalizeCode(code);
    const existing = this.rooms.get(normalized);
    if (existing) {
      return existing;
    }
    const world = await this.persistence.loadDarknessWorld(normalized);
    if (!world) {
      return undefined;
    }
    const room: DarknessRoom = { world, clients: new Set(), dirty: false, lastSavedAt: Date.now() };
    this.rooms.set(normalized, room);
    return room;
  }

  private handleConnection(socket: WebSocket): void {
    const session: DarknessClientSession = { socket, lastInputAt: Date.now() };

    socket.on("message", (data) => {
      void this.handleMessage(session, data.toString());
    });

    socket.on("close", () => {
      this.handleClose(session);
    });

    socket.on("error", () => {
      this.handleClose(session);
    });
  }

  private async handleMessage(session: DarknessClientSession, raw: string): Promise<void> {
    let message: DarknessClientMessage;
    try {
      message = parseDarknessClientMessage(JSON.parse(raw));
    } catch {
      sendDarkness(session.socket, { type: "darkness_error", payload: { message: "Invalid Darkness message." } });
      return;
    }

    if (message.type === "join_darkness_world") {
      await this.joinWorld(session, message.payload.worldCode, message.payload.playerName);
      return;
    }

    const room = await this.requireRoom(session);
    if (!room || !session.playerId) {
      return;
    }

    const now = Date.now();
    switch (message.type) {
      case "darkness_input": {
        const delta = Math.max(16, Math.min(250, now - session.lastInputAt));
        session.lastInputAt = now;
        const result = applyDarknessInput(room.world, session.playerId, message.payload as DarknessInputState, delta, now);
        if (!result.ok) {
          sendDarkness(session.socket, {
            type: "darkness_error",
            payload: { message: result.error ?? "Could not move." }
          });
          return;
        }
        room.dirty = true;
        this.broadcast(room, { type: "darkness_delta", payload: { world: room.world, reason: "input" } });
        break;
      }
      case "darkness_zap": {
        const result = applyDarknessZap(room.world, session.playerId, now);
        this.handleMutation(room, session, result.ok, result.error, result.value, "zap");
        break;
      }
      case "darkness_activate_shield": {
        const result = activateDarknessShield(room.world, session.playerId, now);
        this.handleMutation(room, session, result.ok, result.error, "Shield active.", "shield");
        break;
      }
      case "darkness_buy_house": {
        const result = buyDarknessHouse(room.world, session.playerId, now);
        this.handleMutation(room, session, result.ok, result.error, "House purchase complete.", "buy_house");
        break;
      }
      case "darkness_request_save": {
        await this.persistence.saveDarknessWorld(room.world);
        room.dirty = false;
        room.lastSavedAt = now;
        sendDarkness(session.socket, { type: "darkness_event", payload: { message: "Darkness world saved." } });
        break;
      }
    }
  }

  private async joinWorld(session: DarknessClientSession, rawCode: string, rawName: string): Promise<void> {
    const code = normalizeCode(rawCode);
    const room = await this.getOrLoadRoom(code);
    if (!room) {
      sendDarkness(session.socket, { type: "darkness_error", payload: { message: "Darkness code not found." } });
      return;
    }

    const result = addPlayerToDarknessWorld(room.world, createPlayerId(), rawName.trim(), Date.now());
    if (!result.ok || !result.value) {
      sendDarkness(session.socket, {
        type: "darkness_error",
        payload: { message: result.error ?? "Could not join this Darkness room." }
      });
      return;
    }

    session.playerId = result.value.id;
    session.worldCode = code;
    room.clients.add(session);
    room.dirty = true;
    sendDarkness(session.socket, {
      type: "darkness_joined",
      payload: { playerId: result.value.id, worldCode: code }
    });
    sendDarkness(session.socket, { type: "darkness_snapshot", payload: { world: room.world } });
    this.broadcastExcept(room, session, {
      type: "darkness_event",
      payload: { message: `${result.value.name} joined Survival in the Darkness.` }
    });
    this.broadcastExcept(room, session, {
      type: "darkness_delta",
      payload: { world: room.world, reason: "player_joined" }
    });
  }

  private async requireRoom(session: DarknessClientSession): Promise<DarknessRoom | undefined> {
    if (!session.worldCode) {
      sendDarkness(session.socket, { type: "darkness_error", payload: { message: "Join a Darkness room first." } });
      return undefined;
    }
    const room = await this.getOrLoadRoom(session.worldCode);
    if (!room) {
      sendDarkness(session.socket, { type: "darkness_error", payload: { message: "Darkness room is not loaded." } });
      return undefined;
    }
    return room;
  }

  private handleMutation(
    room: DarknessRoom,
    session: DarknessClientSession,
    ok: boolean,
    error: string | undefined,
    successMessage: string | undefined,
    reason: string
  ): void {
    if (!ok) {
      sendDarkness(session.socket, { type: "darkness_error", payload: { message: error ?? "Action failed." } });
      return;
    }
    room.dirty = true;
    if (successMessage) {
      sendDarkness(session.socket, { type: "darkness_event", payload: { message: successMessage } });
    }
    this.broadcast(room, { type: "darkness_delta", payload: { world: room.world, reason } });
  }

  private handleClose(session: DarknessClientSession): void {
    if (!session.worldCode) {
      return;
    }
    const room = this.rooms.get(session.worldCode);
    if (!room) {
      return;
    }
    room.clients.delete(session);
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      tickDarknessWorld(room.world, now);
      if (room.clients.size > 0) {
        this.broadcast(room, { type: "darkness_delta", payload: { world: room.world, reason: "tick" } });
      }
      if (room.dirty && now - room.lastSavedAt > 10_000) {
        await this.persistence.saveDarknessWorld(room.world);
        room.dirty = false;
        room.lastSavedAt = now;
      }
    }
  }

  private broadcast(room: DarknessRoom, message: DarknessServerMessage): void {
    for (const client of room.clients) {
      sendDarkness(client.socket, message);
    }
  }

  private broadcastExcept(
    room: DarknessRoom,
    excluded: DarknessClientSession,
    message: DarknessServerMessage
  ): void {
    for (const client of room.clients) {
      if (client !== excluded) {
        sendDarkness(client.socket, message);
      }
    }
  }
}

function sendDarkness(socket: WebSocket, message: DarknessServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(serializeDarknessServerMessage(message));
  }
}
