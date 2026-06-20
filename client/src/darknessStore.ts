import { create } from "zustand";
import type { DarknessClientMessage, DarknessServerMessage, DarknessWorldState } from "@jettis/shared";
import type { ConnectionStatus } from "./store.js";

interface DarknessStore {
  socket?: WebSocket;
  status: ConnectionStatus;
  playerId?: string;
  worldCode?: string;
  world?: DarknessWorldState;
  messages: string[];
  setSocket: (socket?: WebSocket) => void;
  setStatus: (status: ConnectionStatus) => void;
  handleServerMessage: (message: DarknessServerMessage) => void;
  send: (message: DarknessClientMessage) => void;
  pushMessage: (message: string) => void;
  reset: () => void;
}

export const useDarknessStore = create<DarknessStore>((set, get) => ({
  status: "idle",
  messages: [],
  setSocket: (socket) => set({ socket }),
  setStatus: (status) => set({ status }),
  handleServerMessage: (message) => {
    switch (message.type) {
      case "darkness_joined":
        set({ playerId: message.payload.playerId, worldCode: message.payload.worldCode, status: "connected" });
        break;
      case "darkness_snapshot":
      case "darkness_delta":
        set({ world: message.payload.world });
        break;
      case "darkness_event":
        get().pushMessage(message.payload.message);
        break;
      case "darkness_error":
        get().pushMessage(message.payload.message);
        break;
    }
  },
  send: (message) => {
    const socket = get().socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  },
  pushMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages].slice(0, 5)
    })),
  reset: () =>
    set({
      socket: undefined,
      status: "idle",
      playerId: undefined,
      worldCode: undefined,
      world: undefined,
      messages: []
    })
}));

export function getLocalDarknessPlayer(world: DarknessWorldState | undefined, playerId: string | undefined) {
  return world && playerId ? world.players[playerId] : undefined;
}
