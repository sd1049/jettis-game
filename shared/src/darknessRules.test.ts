import { describe, expect, it } from "vitest";
import {
  activateDarknessShield,
  addPlayerToDarknessWorld,
  applyDarknessInput,
  applyDarknessZap,
  buyDarknessHouse,
  DARKNESS_HOUSE_PRICE,
  forceDarknessPhase,
  parseDarknessClientMessage,
  tickDarknessWorld
} from "./index.js";
import { createInitialDarknessWorld } from "./darknessWorld.js";

describe("darkness protocol validation", () => {
  it("rejects malformed messages", () => {
    expect(() => parseDarknessClientMessage({ type: "darkness_input", payload: { moveX: 4, moveY: 0 } })).toThrow();
  });
});

describe("darkness coin rules", () => {
  it("creates deterministic but varied maps by room code", () => {
    const first = createInitialDarknessWorld("1234", 1000);
    const repeat = createInitialDarknessWorld("1234", 1000);
    const other = createInitialDarknessWorld("5678", 1000);

    expect(repeat.house.position).toEqual(first.house.position);
    expect(repeat.caves).toEqual(first.caves);
    expect(repeat.coins.map((coin) => coin.position)).toEqual(first.coins.map((coin) => coin.position));
    expect(other.house.position).not.toEqual(first.house.position);
  });

  it("creates enough coin value to avoid a two-player stalemate", () => {
    const world = createInitialDarknessWorld("COINS", 1000);
    const totalCoinValue = world.coins.reduce((sum, coin) => sum + coin.value, 0);

    expect(totalCoinValue).toBeGreaterThanOrEqual(DARKNESS_HOUSE_PRICE * 2 + 20);
  });

  it("spawns catch-up coins when an existing room would stalemate", () => {
    const world = createInitialDarknessWorld("STALE", 1000);
    const sister = addPlayerToDarknessWorld(world, "p1", "Sister", 1000).value!;
    const brother = addPlayerToDarknessWorld(world, "p2", "Brother", 1000).value!;
    world.coins = [];
    world.players[sister.id]!.coins = DARKNESS_HOUSE_PRICE - 1;
    world.players[brother.id]!.coins = DARKNESS_HOUSE_PRICE - 2;

    tickDarknessWorld(world, 2000);

    const availableTotal =
      world.coins.reduce((sum, coin) => sum + coin.value, 0) +
      Object.values(world.players).reduce((sum, player) => sum + player.coins, 0);
    expect(availableTotal).toBeGreaterThanOrEqual(DARKNESS_HOUSE_PRICE * 2 + 20);
  });

  it("collects nearby coins and removes them", () => {
    const world = createInitialDarknessWorld("DARK01", 1000);
    const player = addPlayerToDarknessWorld(world, "p1", "Brother", 1000).value!;
    world.coins = [{ id: "coin-test", position: { ...player.position }, value: 2 }];

    const result = applyDarknessInput(
      world,
      player.id,
      { moveX: 0, moveY: 0 },
      80,
      1080
    );

    expect(result.ok).toBe(true);
    expect(world.players[player.id]!.coins).toBe(2);
    expect(world.coins).toHaveLength(0);
  });

  it("moves touch and pointer players faster than keyboard players", () => {
    const keyboardWorld = createInitialDarknessWorld("SPEED1", 1000);
    const touchWorld = createInitialDarknessWorld("SPEED2", 1000);
    const pointerWorld = createInitialDarknessWorld("SPEED3", 1000);
    const keyboardPlayer = addPlayerToDarknessWorld(keyboardWorld, "p1", "Keyboard", 1000).value!;
    const touchPlayer = addPlayerToDarknessWorld(touchWorld, "p1", "Touch", 1000).value!;
    const pointerPlayer = addPlayerToDarknessWorld(pointerWorld, "p1", "Pointer", 1000).value!;
    const keyboardStart = keyboardPlayer.position.x;
    const touchStart = touchPlayer.position.x;
    const pointerStart = pointerPlayer.position.x;

    applyDarknessInput(keyboardWorld, keyboardPlayer.id, { moveX: 1, moveY: 0, control: "keyboard" }, 1000, 2000);
    applyDarknessInput(touchWorld, touchPlayer.id, { moveX: 1, moveY: 0, control: "touch" }, 1000, 2000);
    applyDarknessInput(pointerWorld, pointerPlayer.id, { moveX: 1, moveY: 0, control: "pointer" }, 1000, 2000);

    expect(touchWorld.players[touchPlayer.id]!.position.x - touchStart).toBeGreaterThan(
      keyboardWorld.players[keyboardPlayer.id]!.position.x - keyboardStart
    );
    expect(pointerWorld.players[pointerPlayer.id]!.position.x - pointerStart).toBeGreaterThan(
      keyboardWorld.players[keyboardPlayer.id]!.position.x - keyboardStart
    );
  });
});

describe("darkness zap and shield rules", () => {
  it("stuns nearby players and respects cooldown", () => {
    const world = createInitialDarknessWorld("DARK02", 1000);
    const attacker = addPlayerToDarknessWorld(world, "p1", "Sister", 1000).value!;
    const target = addPlayerToDarknessWorld(world, "p2", "Brother", 1000).value!;
    world.players[target.id]!.position = { x: attacker.position.x + 40, y: attacker.position.y };

    const zap = applyDarknessZap(world, attacker.id, 1200);
    expect(zap.ok).toBe(true);
    expect(world.players[target.id]!.stunnedUntil).toBeGreaterThan(1200);
    expect(applyDarknessZap(world, attacker.id, 1300).ok).toBe(false);
  });

  it("blocks zap stun while shield is active", () => {
    const world = createInitialDarknessWorld("DARK03", 1000);
    const attacker = addPlayerToDarknessWorld(world, "p1", "Sister", 1000).value!;
    const target = addPlayerToDarknessWorld(world, "p2", "Brother", 1000).value!;
    world.players[target.id]!.position = { x: attacker.position.x + 40, y: attacker.position.y };

    expect(activateDarknessShield(world, target.id, 1100).ok).toBe(true);
    expect(applyDarknessZap(world, attacker.id, 1200).ok).toBe(true);
    expect(world.players[target.id]!.stunnedUntil).toBe(0);
    expect(activateDarknessShield(world, target.id, 1300).ok).toBe(false);
    expect(activateDarknessShield(world, target.id, 11_200).ok).toBe(true);
  });

  it("prevents stunned players from moving until stun expires", () => {
    const world = createInitialDarknessWorld("DARK04", 1000);
    const player = addPlayerToDarknessWorld(world, "p1", "Brother", 1000).value!;
    const start = { ...player.position };
    world.players[player.id]!.stunnedUntil = 3000;

    applyDarknessInput(world, player.id, { moveX: 1, moveY: 0 }, 1000, 2000);
    expect(world.players[player.id]!.position).toEqual(start);

    applyDarknessInput(world, player.id, { moveX: 1, moveY: 0 }, 1000, 3100);
    expect(world.players[player.id]!.position.x).toBeGreaterThan(start.x);
  });
});

describe("darkness house and day/night rules", () => {
  it("requires enough coins to buy the house and wins when purchased", () => {
    const world = createInitialDarknessWorld("DARK05", 1000);
    const player = addPlayerToDarknessWorld(world, "p1", "Brother", 1000).value!;
    world.players[player.id]!.position = { ...world.house.position };

    expect(buyDarknessHouse(world, player.id, 1100).ok).toBe(false);
    world.players[player.id]!.coins = world.house.price;
    expect(buyDarknessHouse(world, player.id, 1200).ok).toBe(true);
    expect(world.winnerPlayerId).toBe(player.id);
  });

  it("transitions between morning and night", () => {
    const world = createInitialDarknessWorld("DARK06", 1000);
    world.dayNight.phaseEndsAt = 1001;
    tickDarknessWorld(world, 1100);
    expect(world.dayNight.phase).toBe("night");

    const night = forceDarknessPhase(world, "night", 2000);
    night.dayNight.phaseEndsAt = 2001;
    tickDarknessWorld(night, 2200);
    expect(night.dayNight.phase).toBe("morning");
  });
});
