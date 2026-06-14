import { describe, expect, it } from "vitest";
import {
  acceptTrade,
  addPlayerToWorld,
  applyBlockEdit,
  applyPlayerInput,
  forcePhase,
  isPositionInSafeHouse,
  parseClientMessage,
  startTrade,
  tickWorld,
  updateTradeOffer
} from "./index.js";
import { createInitialWorld } from "./world.js";

describe("protocol validation", () => {
  it("rejects malformed client messages", () => {
    expect(() => parseClientMessage({ type: "edit_block", payload: { action: "place" } })).toThrow();
  });
});

describe("block edit rules", () => {
  it("breaks and places blocks through inventory", () => {
    const world = createInitialWorld("TEST01", 1000);
    const player = addPlayerToWorld(world, "p1", "Sister", 1000).value!;

    const breakResult = applyBlockEdit(world, player.id, { action: "break", position: { x: 11, y: 7, z: 11 } }, 1000);
    expect(breakResult.ok).toBe(true);
    expect(world.blocks["11,7,11"]).toBeUndefined();
    expect(world.players[player.id]!.inventory.wood).toBeGreaterThanOrEqual(25);

    const placeResult = applyBlockEdit(
      world,
      player.id,
      { action: "place", position: { x: 11, y: 7, z: 11 }, blockType: "wood" },
      1000
    );
    expect(placeResult.ok).toBe(true);
    expect(world.blocks["11,7,11"]?.type).toBe("wood");
  });
});

describe("safe houses", () => {
  it("detects the starter safe house and rejects open air", () => {
    const world = createInitialWorld("SAFE01", 1000);
    const player = addPlayerToWorld(world, "p1", "Sister", 1000).value!;
    applyPlayerInput(
      world,
      player.id,
      { moveX: 0, moveZ: 0, lookY: 0, jump: false, fly: false, descend: false, sprint: false },
      80,
      1080
    );
    expect(isPositionInSafeHouse(world, { x: 11, y: 8, z: 11 })).toBe(true);
    expect(world.players[player.id]!.isSafe).toBe(true);
    expect(world.players[player.id]!.position.y).toBe(8);
    expect(isPositionInSafeHouse(world, { x: 31, y: 8, z: 31 })).toBe(false);
  });
});

describe("trading", () => {
  it("requires both players to accept and preserves item counts", () => {
    const world = createInitialWorld("TRADE1", 1000);
    const sister = addPlayerToWorld(world, "p1", "Sister", 1000).value!;
    const brother = addPlayerToWorld(world, "p2", "Brother", 1000).value!;
    world.players[brother.id]!.position = { ...sister.position };

    const trade = startTrade(world, sister.id, brother.id, 1000).value!;
    expect(updateTradeOffer(world, sister.id, trade.id, { wood: 2 }, 1000).ok).toBe(true);
    expect(updateTradeOffer(world, brother.id, trade.id, { berries: 1 }, 1000).ok).toBe(true);
    expect(acceptTrade(world, sister.id, trade.id, 1000).value!.status).toBe("pending");
    expect(acceptTrade(world, brother.id, trade.id, 1000).value!.status).toBe("completed");
    expect(world.players[sister.id]!.inventory.berries).toBe(4);
    expect(world.players[brother.id]!.inventory.wood).toBe(26);
  });
});

describe("day/night rules", () => {
  it("spawns outdoor creatures when night ticks", () => {
    const world = createInitialWorld("NIGHT1", 1000);
    const night = forcePhase(world, "night", 2000);
    night.dayNight.phaseEndsAt = 1;
    tickWorld(night, 3000);
    expect(night.dayNight.phase).toBe("day");

    const nearlyNight = createInitialWorld("NIGHT2", 1000);
    nearlyNight.dayNight.phaseEndsAt = 1001;
    tickWorld(nearlyNight, 2000);
    expect(nearlyNight.dayNight.phase).toBe("night");
    expect(nearlyNight.creatures.some((creature) => creature.kind === "shadow_splasher")).toBe(true);
  });
});
