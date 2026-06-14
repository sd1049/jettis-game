import type { IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  acceptTrade,
  addPlayerToWorld,
  applyBlockEdit,
  applyPlayerInput,
  applyToolUse,
  interactWithTarget,
  parseClientMessage,
  serializeServerMessage,
  startTrade,
  tickWorld,
  updateTradeOffer,
  type ClientMessage,
  type PlayerInputState,
  type ServerMessage,
  type WorldState
} from "@jettis/shared";
import { createPlayerId } from "./ids.js";
import { normalizeCode, type Persistence } from "./persistence.js";

interface ClientSession {
  socket: WebSocket;
  playerId?: string;
  worldCode?: string;
  lastInputAt: number;
}

interface Room {
  world: WorldState;
  clients: Set<ClientSession>;
  dirty: boolean;
  lastSavedAt: number;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private tickTimer?: NodeJS.Timeout;

  constructor(private persistence: Persistence) {}

  attach(server: WebSocketServer): void {
    server.on("connection", (socket, request) => {
      this.handleConnection(socket, request);
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

  async getOrLoadRoom(code: string): Promise<Room | undefined> {
    const normalized = normalizeCode(code);
    const existing = this.rooms.get(normalized);
    if (existing) {
      return existing;
    }
    const world = await this.persistence.loadWorld(normalized);
    if (!world) {
      return undefined;
    }
    const room: Room = { world, clients: new Set(), dirty: false, lastSavedAt: Date.now() };
    this.rooms.set(normalized, room);
    return room;
  }

  async ensureWorld(code: string): Promise<WorldState | undefined> {
    return this.persistence.loadWorld(normalizeCode(code));
  }

  private handleConnection(socket: WebSocket, _request: IncomingMessage): void {
    const session: ClientSession = { socket, lastInputAt: Date.now() };

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

  private async handleMessage(session: ClientSession, raw: string): Promise<void> {
    let message: ClientMessage;
    try {
      message = parseClientMessage(JSON.parse(raw));
    } catch {
      send(session.socket, { type: "error", payload: { message: "Invalid message format." } });
      return;
    }

    if (message.type === "join_world") {
      await this.joinWorld(session, message.payload.worldCode, message.payload.playerName);
      return;
    }

    const room = await this.requireRoom(session);
    if (!room || !session.playerId) {
      return;
    }

    const now = Date.now();
    switch (message.type) {
      case "player_input": {
        const delta = Math.max(16, Math.min(250, now - session.lastInputAt));
        session.lastInputAt = now;
        const result = applyPlayerInput(room.world, session.playerId, message.payload as PlayerInputState, delta, now);
        if (!result.ok) {
          send(session.socket, { type: "error", payload: { message: result.error ?? "Could not move." } });
          return;
        }
        room.dirty = true;
        this.broadcast(room, { type: "world_delta", payload: { world: room.world, reason: "player_input" } });
        break;
      }
      case "edit_block": {
        const result = applyBlockEdit(room.world, session.playerId, message.payload, now);
        this.handleWorldMutationResult(room, session, result.ok, result.error, "edit_block");
        break;
      }
      case "use_tool": {
        const result = applyToolUse(room.world, session.playerId, message.payload, now);
        this.handleWorldMutationResult(room, session, result.ok, result.error, "use_tool");
        break;
      }
      case "start_trade": {
        const result = startTrade(room.world, session.playerId, message.payload.otherPlayerId, now);
        if (!result.ok || !result.value) {
          send(session.socket, { type: "error", payload: { message: result.error ?? "Could not start trade." } });
          return;
        }
        room.dirty = true;
        this.broadcast(room, { type: "trade_update", payload: { trade: result.value } });
        this.broadcast(room, { type: "world_delta", payload: { world: room.world, reason: "start_trade" } });
        break;
      }
      case "update_trade": {
        const result = updateTradeOffer(room.world, session.playerId, message.payload.tradeId, message.payload.items, now);
        if (!result.ok || !result.value) {
          send(session.socket, { type: "error", payload: { message: result.error ?? "Could not update trade." } });
          return;
        }
        room.dirty = true;
        this.broadcast(room, { type: "trade_update", payload: { trade: result.value } });
        break;
      }
      case "accept_trade": {
        const result = acceptTrade(room.world, session.playerId, message.payload.tradeId, now);
        if (!result.ok || !result.value) {
          send(session.socket, { type: "error", payload: { message: result.error ?? "Could not accept trade." } });
          return;
        }
        room.dirty = true;
        this.broadcast(room, { type: "trade_update", payload: { trade: result.value } });
        this.broadcast(room, { type: "world_delta", payload: { world: room.world, reason: "accept_trade" } });
        break;
      }
      case "interact": {
        const result = interactWithTarget(room.world, session.playerId, message.payload.targetKind, message.payload.targetId, now);
        if (!result.ok) {
          send(session.socket, { type: "error", payload: { message: result.error ?? "Could not interact." } });
          return;
        }
        room.dirty = true;
        send(session.socket, { type: "event", payload: { message: result.value ?? "Interaction complete." } });
        this.broadcast(room, { type: "world_delta", payload: { world: room.world, reason: "interact" } });
        break;
      }
      case "request_save": {
        await this.persistence.saveWorld(room.world);
        room.dirty = false;
        room.lastSavedAt = now;
        send(session.socket, { type: "event", payload: { message: "World saved." } });
        break;
      }
    }
  }

  private async joinWorld(session: ClientSession, rawCode: string, rawName: string): Promise<void> {
    const code = normalizeCode(rawCode);
    const room = await this.getOrLoadRoom(code);
    if (!room) {
      send(session.socket, { type: "error", payload: { message: "World code not found." } });
      return;
    }

    const playerId = createPlayerId();
    const result = addPlayerToWorld(room.world, playerId, rawName.trim(), Date.now());
    if (!result.ok || !result.value) {
      send(session.socket, { type: "error", payload: { message: result.error ?? "Could not join this world." } });
      return;
    }

    session.playerId = result.value.id;
    session.worldCode = code;
    room.clients.add(session);
    room.dirty = true;
    send(session.socket, { type: "joined", payload: { playerId: result.value.id, worldCode: code } });
    send(session.socket, { type: "world_snapshot", payload: { world: room.world } });
    this.broadcastExcept(room, session, {
      type: "player_joined",
      payload: { playerId: result.value.id, name: result.value.name }
    });
    this.broadcastExcept(room, session, { type: "world_delta", payload: { world: room.world, reason: "player_joined" } });
  }

  private async requireRoom(session: ClientSession): Promise<Room | undefined> {
    if (!session.worldCode) {
      send(session.socket, { type: "error", payload: { message: "Join a world first." } });
      return undefined;
    }
    const room = await this.getOrLoadRoom(session.worldCode);
    if (!room) {
      send(session.socket, { type: "error", payload: { message: "World is not loaded." } });
      return undefined;
    }
    return room;
  }

  private handleWorldMutationResult(
    room: Room,
    session: ClientSession,
    ok: boolean,
    error: string | undefined,
    reason: string
  ): void {
    if (!ok) {
      send(session.socket, { type: "error", payload: { message: error ?? "Action failed." } });
      return;
    }
    room.dirty = true;
    this.broadcast(room, { type: "world_delta", payload: { world: room.world, reason } });
  }

  private handleClose(session: ClientSession): void {
    if (!session.worldCode) {
      return;
    }
    const room = this.rooms.get(session.worldCode);
    if (!room) {
      return;
    }
    room.clients.delete(session);
    if (session.playerId) {
      this.broadcast(room, { type: "player_left", payload: { playerId: session.playerId } });
    }
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      tickWorld(room.world, now);
      if (room.clients.size > 0) {
        this.broadcast(room, { type: "world_delta", payload: { world: room.world, reason: "tick" } });
      }
      if (room.dirty && now - room.lastSavedAt > 10_000) {
        await this.persistence.saveWorld(room.world);
        room.dirty = false;
        room.lastSavedAt = now;
      }
    }
  }

  private broadcast(room: Room, message: ServerMessage): void {
    for (const client of room.clients) {
      send(client.socket, message);
    }
  }

  private broadcastExcept(room: Room, excluded: ClientSession, message: ServerMessage): void {
    for (const client of room.clients) {
      if (client !== excluded) {
        send(client.socket, message);
      }
    }
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(serializeServerMessage(message));
  }
}
