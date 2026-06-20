import { z } from "zod";
import type {
  DarknessInputState,
  DarknessWorldState,
  DarknessWorldSummary,
  JoinDarknessWorldPayload
} from "./darknessTypes.js";

export const darknessInputSchema = z.object({
  moveX: z.number().finite().min(-1).max(1),
  moveY: z.number().finite().min(-1).max(1),
  control: z.enum(["keyboard", "touch", "pointer"]).optional()
});

export const joinDarknessWorldSchema = z.object({
  worldCode: z.string().trim().min(4).max(12),
  playerName: z.string().trim().min(1).max(20)
});

export const darknessClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join_darkness_world"),
    payload: joinDarknessWorldSchema
  }),
  z.object({
    type: z.literal("darkness_input"),
    payload: darknessInputSchema
  }),
  z.object({
    type: z.literal("darkness_zap"),
    payload: z.object({}).default({})
  }),
  z.object({
    type: z.literal("darkness_activate_shield"),
    payload: z.object({}).default({})
  }),
  z.object({
    type: z.literal("darkness_buy_house"),
    payload: z.object({}).default({})
  }),
  z.object({
    type: z.literal("darkness_request_save"),
    payload: z.object({}).default({})
  })
]);

export type DarknessClientMessage = z.infer<typeof darknessClientMessageSchema>;

export type DarknessServerMessage =
  | { type: "darkness_joined"; payload: { playerId: string; worldCode: string } }
  | { type: "darkness_snapshot"; payload: { world: DarknessWorldState } }
  | { type: "darkness_delta"; payload: { world: DarknessWorldState; reason: string } }
  | { type: "darkness_event"; payload: { message: string; kind?: string } }
  | { type: "darkness_error"; payload: { message: string } };

export function parseDarknessClientMessage(raw: unknown): DarknessClientMessage {
  return darknessClientMessageSchema.parse(raw);
}

export function serializeDarknessServerMessage(message: DarknessServerMessage): string {
  return JSON.stringify(message);
}

export type { DarknessInputState, DarknessWorldState, DarknessWorldSummary, JoinDarknessWorldPayload };
