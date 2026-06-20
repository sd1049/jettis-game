import type { DarknessServerMessage, JoinDarknessWorldPayload } from "@jettis/shared";
import { useDarknessStore } from "./darknessStore.js";

export async function createDarknessWorld(): Promise<string> {
  const response = await fetch("/api/darkness/worlds", { method: "POST" });
  if (!response.ok) {
    throw new Error("Could not create a Darkness room.");
  }
  const body = (await response.json()) as { code: string };
  return body.code;
}

export function connectToDarknessWorld(payload: JoinDarknessWorldPayload): void {
  const store = useDarknessStore.getState();
  store.socket?.close();
  store.setStatus("connecting");

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${window.location.host}/darkness-ws`);
  store.setSocket(socket);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "join_darkness_world", payload }));
  });

  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data as string) as DarknessServerMessage;
      useDarknessStore.getState().handleServerMessage(message);
    } catch {
      useDarknessStore.getState().pushMessage("The Darkness server sent an unreadable update.");
    }
  });

  socket.addEventListener("close", () => {
    useDarknessStore.getState().setStatus("disconnected");
  });

  socket.addEventListener("error", () => {
    useDarknessStore.getState().pushMessage("Darkness connection error. Try rejoining the code.");
    useDarknessStore.getState().setStatus("disconnected");
  });
}
