import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { DarknessServerMessage, ServerMessage } from "@jettis/shared";
import { createAppServer, type AppServer } from "./http.js";
import { MemoryPersistence } from "./persistence.js";

let app: AppServer | undefined;

afterEach(async () => {
  await app?.stop();
  app = undefined;
});

describe("HTTP and WebSocket integration", () => {
  it("creates a world, joins with two players, saves, and rejoins by code", async () => {
    app = await createAppServer(new MemoryPersistence());
    await app.start(0);
    const baseUrl = getBaseUrl(app);

    const createResponse = await fetch(`${baseUrl}/api/worlds`, { method: "POST" });
    expect(createResponse.status).toBe(201);
    const { code } = (await createResponse.json()) as { code: string };

    const sister = new WebSocket(`${baseUrl.replace("http", "ws")}/ws`);
    const brother = new WebSocket(`${baseUrl.replace("http", "ws")}/ws`);
    await Promise.all([openSocket(sister), openSocket(brother)]);

    sister.send(JSON.stringify({ type: "join_world", payload: { worldCode: code, playerName: "Sister" } }));
    brother.send(JSON.stringify({ type: "join_world", payload: { worldCode: code, playerName: "Brother" } }));

    const sisterJoined = await waitFor(sister, "joined");
    const brotherJoined = await waitFor(brother, "joined");
    expect(sisterJoined.payload.worldCode).toBe(code);
    expect(brotherJoined.payload.worldCode).toBe(code);

    sister.send(
      JSON.stringify({
        type: "edit_block",
        payload: { action: "break", position: { x: 11, y: 7, z: 11 } }
      })
    );
    const editDelta = await waitFor(sister, "world_delta");
    expect(editDelta.payload.world.blocks["11,7,11"]).toBeUndefined();

    sister.send(JSON.stringify({ type: "request_save", payload: {} }));
    const saved = await waitFor(sister, "event");
    expect(saved.payload.message).toContain("saved");

    sister.close();
    brother.close();

    const summaryResponse = await fetch(`${baseUrl}/api/worlds/${code}/summary`);
    expect(summaryResponse.status).toBe(200);
    const summary = (await summaryResponse.json()) as { playerCount: number };
    expect(summary.playerCount).toBe(2);

    const rejoin = new WebSocket(`${baseUrl.replace("http", "ws")}/ws`);
    await openSocket(rejoin);
    rejoin.send(JSON.stringify({ type: "join_world", payload: { worldCode: code, playerName: "Sister" } }));
    const rejoined = await waitFor(rejoin, "world_snapshot");
    expect(Object.values(rejoined.payload.world.players).some((player) => player.name === "Sister")).toBe(true);
    rejoin.close();
  });

  it("creates and plays a Darkness room through WebSockets", async () => {
    const persistence = new MemoryPersistence();
    app = await createAppServer(persistence);
    await app.start(0);
    const baseUrl = getBaseUrl(app);

    const createResponse = await fetch(`${baseUrl}/api/darkness/worlds`, { method: "POST" });
    expect(createResponse.status).toBe(201);
    const { code } = (await createResponse.json()) as { code: string };

    const seededWorld = await persistence.loadDarknessWorld(code);
    expect(seededWorld).toBeDefined();
    const firstCave = seededWorld!.caves[0]!;
    const firstSpawn = { x: firstCave.position.x - 22, y: firstCave.position.y - 18 };
    seededWorld!.coins = [{ id: "test-coin", position: firstSpawn, value: 25 }];
    seededWorld!.house.position = firstSpawn;
    await persistence.saveDarknessWorld(seededWorld!);

    const sister = new WebSocket(`${baseUrl.replace("http", "ws")}/darkness-ws`);
    const brother = new WebSocket(`${baseUrl.replace("http", "ws")}/darkness-ws`);
    await Promise.all([openSocket(sister), openSocket(brother)]);

    sister.send(JSON.stringify({ type: "join_darkness_world", payload: { worldCode: code, playerName: "Sister" } }));
    brother.send(JSON.stringify({ type: "join_darkness_world", payload: { worldCode: code, playerName: "Brother" } }));

    const sisterJoined = await waitForDarkness(sister, "darkness_joined");
    const brotherJoined = await waitForDarkness(brother, "darkness_joined");
    expect(sisterJoined.payload.worldCode).toBe(code);
    expect(brotherJoined.payload.worldCode).toBe(code);

    sister.send(JSON.stringify({ type: "darkness_input", payload: { moveX: 0, moveY: 0 } }));
    const coinDelta = await waitForDarknessWhere(
      sister,
      "darkness_delta",
      (message) => message.payload.world.players[sisterJoined.payload.playerId]!.coins === 25
    );
    expect(coinDelta.payload.world.players[sisterJoined.payload.playerId]!.coins).toBe(25);

    sister.send(JSON.stringify({ type: "darkness_activate_shield", payload: {} }));
    const shieldDelta = await waitForDarknessWhere(
      sister,
      "darkness_delta",
      (message) => message.payload.world.players[sisterJoined.payload.playerId]!.shieldActiveUntil > 0
    );
    expect(shieldDelta.payload.world.players[sisterJoined.payload.playerId]!.shieldActiveUntil).toBeGreaterThan(0);

    sister.send(JSON.stringify({ type: "darkness_buy_house", payload: {} }));
    const winDelta = await waitForDarknessWhere(
      sister,
      "darkness_delta",
      (message) => message.payload.world.winnerPlayerId === sisterJoined.payload.playerId
    );
    expect(winDelta.payload.world.house.ownerPlayerId).toBe(sisterJoined.payload.playerId);

    sister.send(JSON.stringify({ type: "darkness_request_save", payload: {} }));
    const saved = await waitForDarkness(sister, "darkness_event");
    expect(saved.payload.message).toContain("saved");

    sister.close();
    brother.close();

    const summaryResponse = await fetch(`${baseUrl}/api/darkness/worlds/${code}/summary`);
    expect(summaryResponse.status).toBe(200);
    const summary = (await summaryResponse.json()) as { winnerPlayerId?: string };
    expect(summary.winnerPlayerId).toBe(sisterJoined.payload.playerId);

    const rejoin = new WebSocket(`${baseUrl.replace("http", "ws")}/darkness-ws`);
    await openSocket(rejoin);
    rejoin.send(JSON.stringify({ type: "join_darkness_world", payload: { worldCode: code, playerName: "Sister" } }));
    const rejoined = await waitForDarkness(rejoin, "darkness_snapshot");
    expect(rejoined.payload.world.winnerPlayerId).toBe(sisterJoined.payload.playerId);
    rejoin.close();
  });

  it("creates a requested Darkness code and joins it", async () => {
    app = await createAppServer(new MemoryPersistence());
    await app.start(0);
    const baseUrl = getBaseUrl(app);

    const createResponse = await fetch(`${baseUrl}/api/darkness/worlds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "1234" })
    });
    expect(createResponse.status).toBe(201);
    const { code } = (await createResponse.json()) as { code: string };
    expect(code).toBe("1234");

    const repeatResponse = await fetch(`${baseUrl}/api/darkness/worlds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "1234" })
    });
    expect(repeatResponse.status).toBe(201);
    await expect(repeatResponse.json()).resolves.toEqual({ code: "1234" });

    const sister = new WebSocket(`${baseUrl.replace("http", "ws")}/darkness-ws`);
    await openSocket(sister);
    const joinedPromise = waitForDarkness(sister, "darkness_joined");
    const snapshotPromise = waitForDarkness(sister, "darkness_snapshot");
    sister.send(JSON.stringify({ type: "join_darkness_world", payload: { worldCode: "1234", playerName: "Sister" } }));

    const joined = await joinedPromise;
    expect(joined.payload.worldCode).toBe("1234");
    const snapshot = await snapshotPromise;
    expect(snapshot.payload.world.code).toBe("1234");
    sister.close();
  });
});

function getBaseUrl(server: AppServer): string {
  const address = server.httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not bind to a TCP port.");
  }
  return `http://127.0.0.1:${address.port}`;
}

function openSocket(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
}

function waitFor<TType extends ServerMessage["type"]>(
  socket: WebSocket,
  type: TType
): Promise<Extract<ServerMessage, { type: TType }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 5000);
    const onMessage = (data: WebSocket.RawData) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      if (message.type === type) {
        clearTimeout(timeout);
        socket.off("message", onMessage);
        resolve(message as Extract<ServerMessage, { type: TType }>);
      }
    };
    socket.on("message", onMessage);
  });
}

function waitForDarkness<TType extends DarknessServerMessage["type"]>(
  socket: WebSocket,
  type: TType
): Promise<Extract<DarknessServerMessage, { type: TType }>> {
  return waitForDarknessWhere(socket, type, () => true);
}

function waitForDarknessWhere<TType extends DarknessServerMessage["type"]>(
  socket: WebSocket,
  type: TType,
  predicate: (message: Extract<DarknessServerMessage, { type: TType }>) => boolean
): Promise<Extract<DarknessServerMessage, { type: TType }>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 5000);
    const onMessage = (data: WebSocket.RawData) => {
      const message = JSON.parse(data.toString()) as DarknessServerMessage;
      if (message.type === type && predicate(message as Extract<DarknessServerMessage, { type: TType }>)) {
        clearTimeout(timeout);
        socket.off("message", onMessage);
        resolve(message as Extract<DarknessServerMessage, { type: TType }>);
      }
    };
    socket.on("message", onMessage);
  });
}
