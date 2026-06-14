import type { JoinWorldPayload, ServerMessage } from "@jettis/shared";
import { useGameStore } from "./store.js";

export async function createWorld(): Promise<string> {
  const response = await fetch("/api/worlds", { method: "POST" });
  if (!response.ok) {
    throw new Error("Could not create a world.");
  }
  const body = (await response.json()) as { code: string };
  return body.code;
}

export function connectToWorld(payload: JoinWorldPayload): void {
  const store = useGameStore.getState();
  store.socket?.close();
  store.setStatus("connecting");

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${window.location.host}/ws`);
  store.setSocket(socket);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "join_world", payload }));
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data as string) as ServerMessage;
      useGameStore.getState().handleServerMessage(message);
    } catch {
      useGameStore.getState().pushMessage("The server sent an unreadable update.");
    }
  });

  socket.addEventListener("close", () => {
    useGameStore.getState().setStatus("disconnected");
  });

  socket.addEventListener("error", () => {
    useGameStore.getState().pushMessage("Connection error. Try rejoining the world code.");
    useGameStore.getState().setStatus("disconnected");
  });
}
