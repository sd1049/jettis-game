import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { ServerMessage } from "@jettis/shared";
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
