import { z } from "zod";
import { BLOCK_TYPES, ITEM_IDS } from "./constants.js";
import type {
  EditBlockRequest,
  Inventory,
  JoinWorldPayload,
  PlayerInputState,
  TradeState,
  UseToolRequest,
  WorldState,
  WorldSummary
} from "./types.js";

const blockTypeSchema = z.enum(BLOCK_TYPES);
const itemIdSchema = z.enum(ITEM_IDS);

export const vec3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite()
});

export const inventorySchema = z.partialRecord(itemIdSchema, z.number().int().min(0).max(999));

export const joinWorldSchema = z.object({
  worldCode: z.string().trim().min(4).max(12),
  playerName: z.string().trim().min(1).max(20),
  appearance: z
    .object({
      bodyColor: z.string().optional(),
      shirtColor: z.string().optional(),
      pantsColor: z.string().optional(),
      accentColor: z.string().optional()
    })
    .partial()
    .optional()
});

export const playerInputSchema = z.object({
  moveX: z.number().finite().min(-1).max(1),
  moveZ: z.number().finite().min(-1).max(1),
  lookY: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2),
  jump: z.boolean(),
  fly: z.boolean(),
  descend: z.boolean(),
  sprint: z.boolean(),
  tapTarget: vec3Schema.optional()
});

export const editBlockSchema = z.object({
  action: z.enum(["place", "break"]),
  position: vec3Schema.transform((value) => ({
    x: Math.floor(value.x),
    y: Math.floor(value.y),
    z: Math.floor(value.z)
  })),
  blockType: blockTypeSchema.optional()
});

export const useToolSchema = z.object({
  tool: z.enum(["water", "fish", "gather", "victory_flag"]),
  target: vec3Schema.transform((value) => ({
    x: Math.floor(value.x),
    y: Math.floor(value.y),
    z: Math.floor(value.z)
  }))
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join_world"),
    payload: joinWorldSchema
  }),
  z.object({
    type: z.literal("player_input"),
    payload: playerInputSchema
  }),
  z.object({
    type: z.literal("edit_block"),
    payload: editBlockSchema
  }),
  z.object({
    type: z.literal("use_tool"),
    payload: useToolSchema
  }),
  z.object({
    type: z.literal("start_trade"),
    payload: z.object({ otherPlayerId: z.string().min(1) })
  }),
  z.object({
    type: z.literal("update_trade"),
    payload: z.object({ tradeId: z.string().min(1), items: inventorySchema })
  }),
  z.object({
    type: z.literal("accept_trade"),
    payload: z.object({ tradeId: z.string().min(1) })
  }),
  z.object({
    type: z.literal("interact"),
    payload: z.object({ targetId: z.string().min(1), targetKind: z.enum(["villager", "crate", "food"]) })
  }),
  z.object({
    type: z.literal("request_save"),
    payload: z.object({}).default({})
  })
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type ServerMessage =
  | { type: "joined"; payload: { playerId: string; worldCode: string } }
  | { type: "world_snapshot"; payload: { world: WorldState } }
  | { type: "world_delta"; payload: { world: WorldState; reason: string } }
  | { type: "player_joined"; payload: { playerId: string; name: string } }
  | { type: "player_left"; payload: { playerId: string } }
  | { type: "trade_update"; payload: { trade: TradeState } }
  | { type: "event"; payload: { message: string; kind?: string } }
  | { type: "error"; payload: { message: string } };

export function parseClientMessage(raw: unknown): ClientMessage {
  return clientMessageSchema.parse(raw);
}

export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

export type {
  EditBlockRequest,
  Inventory,
  JoinWorldPayload,
  PlayerInputState,
  UseToolRequest,
  WorldState,
  WorldSummary
};
