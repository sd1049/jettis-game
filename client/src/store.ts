import { create } from "zustand";
import type {
  BlockType,
  ClientMessage,
  ServerMessage,
  TradeState,
  Vec3,
  WorldState
} from "@jettis/shared";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

export interface SelectedBlock {
  position: Vec3;
  type?: BlockType;
}

interface GameStore {
  socket?: WebSocket;
  status: ConnectionStatus;
  playerId?: string;
  worldCode?: string;
  world?: WorldState;
  selectedBlock?: SelectedBlock;
  selectedBlockType: BlockType;
  tapTarget?: Vec3;
  activeTrade?: TradeState;
  messages: string[];
  commercialBreak: boolean;
  setSocket: (socket?: WebSocket) => void;
  setStatus: (status: ConnectionStatus) => void;
  handleServerMessage: (message: ServerMessage) => void;
  send: (message: ClientMessage) => void;
  setSelectedBlock: (selectedBlock?: SelectedBlock) => void;
  setSelectedBlockType: (blockType: BlockType) => void;
  setTapTarget: (target?: Vec3) => void;
  pushMessage: (message: string) => void;
  setCommercialBreak: (open: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: "idle",
  selectedBlockType: "wood",
  messages: [],
  commercialBreak: false,
  setSocket: (socket) => set({ socket }),
  setStatus: (status) => set({ status }),
  handleServerMessage: (message) => {
    switch (message.type) {
      case "joined":
        set({ playerId: message.payload.playerId, worldCode: message.payload.worldCode, status: "connected" });
        break;
      case "world_snapshot":
      case "world_delta":
        set({ world: message.payload.world });
        break;
      case "trade_update":
        set({ activeTrade: message.payload.trade });
        break;
      case "event":
        get().pushMessage(message.payload.message);
        break;
      case "error":
        get().pushMessage(message.payload.message);
        break;
      case "player_joined":
        get().pushMessage(`${message.payload.name} joined the island.`);
        break;
      case "player_left":
        get().pushMessage("A player left the island.");
        break;
    }
  },
  send: (message) => {
    const socket = get().socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  },
  setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
  setSelectedBlockType: (selectedBlockType) => set({ selectedBlockType }),
  setTapTarget: (tapTarget) => set({ tapTarget }),
  pushMessage: (message) =>
    set((state) => ({
      messages: [message, ...state.messages].slice(0, 5)
    })),
  setCommercialBreak: (commercialBreak) => set({ commercialBreak }),
  reset: () =>
    set({
      socket: undefined,
      status: "idle",
      playerId: undefined,
      worldCode: undefined,
      world: undefined,
      selectedBlock: undefined,
      tapTarget: undefined,
      activeTrade: undefined,
      messages: [],
      commercialBreak: false
    })
}));

export function getLocalPlayer(world: WorldState | undefined, playerId: string | undefined) {
  return world && playerId ? world.players[playerId] : undefined;
}
