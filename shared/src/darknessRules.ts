import {
  DARKNESS_COIN_PICKUP_RADIUS,
  DARKNESS_HOUSE_RADIUS,
  DARKNESS_MAX_PLAYERS,
  DARKNESS_NIGHT_DURATION_MS,
  DARKNESS_PLAYER_SPEED,
  DARKNESS_SHIELD_COOLDOWN_MS,
  DARKNESS_SHIELD_DURATION_MS,
  DARKNESS_STUN_MS,
  DARKNESS_TOUCH_SPEED_MULTIPLIER,
  DARKNESS_WORLD_SIZE,
  DARKNESS_ZAP_COOLDOWN_MS,
  DARKNESS_ZAP_RANGE
} from "./darknessConstants.js";
import { cloneDarknessWorld, createDarknessPlayer, nextDarknessDayNightState } from "./darknessWorld.js";
import type {
  DarknessInputState,
  DarknessPlayerState,
  DarknessVec2,
  DarknessWorldState
} from "./darknessTypes.js";
import type { ApplyResult } from "./types.js";

export function addPlayerToDarknessWorld(
  world: DarknessWorldState,
  playerId: string,
  name: string,
  now = Date.now()
): ApplyResult<DarknessPlayerState> {
  const existing = Object.values(world.players).find((player) => player.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.lastSeenAt = now;
    return { ok: true, value: existing };
  }
  if (Object.keys(world.players).length >= DARKNESS_MAX_PLAYERS) {
    return { ok: false, error: "This Darkness room is full." };
  }
  const player = createDarknessPlayer(playerId, name, world, now);
  world.players[player.id] = player;
  ensureMinimumDarknessCoinSupply(world, now);
  world.updatedAt = now;
  world.events.unshift({
    id: `darkness-join-${now}`,
    kind: "join",
    message: `${player.name} entered the caves.`,
    createdAt: now
  });
  return { ok: true, value: player };
}

export function applyDarknessInput(
  world: DarknessWorldState,
  playerId: string,
  input: DarknessInputState,
  deltaMs: number,
  now = Date.now()
): ApplyResult<DarknessPlayerState> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this Darkness room." };
  }
  if (world.winnerPlayerId) {
    return { ok: true, value: player };
  }
  player.lastSeenAt = now;
  if (player.stunnedUntil > now) {
    return { ok: true, value: player };
  }

  const length = Math.hypot(input.moveX, input.moveY);
  if (length > 0) {
    const scale = Math.min(1, length);
    const speedMultiplier = input.control === "touch" || input.control === "pointer" ? DARKNESS_TOUCH_SPEED_MULTIPLIER : 1;
    const speed = DARKNESS_PLAYER_SPEED * speedMultiplier;
    const dx = (input.moveX / length) * scale * speed * (deltaMs / 1000);
    const dy = (input.moveY / length) * scale * speed * (deltaMs / 1000);
    player.position = clampPosition({ x: player.position.x + dx, y: player.position.y + dy });
  }

  collectNearbyCoins(world, player, now);
  world.updatedAt = now;
  return { ok: true, value: player };
}

export function applyDarknessZap(world: DarknessWorldState, playerId: string, now = Date.now()): ApplyResult<string> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this Darkness room." };
  }
  if (world.winnerPlayerId) {
    return { ok: false, error: "The round is already over." };
  }
  if (player.stunnedUntil > now) {
    return { ok: false, error: "You are stunned and cannot zap yet." };
  }
  if (player.zapCooldownUntil > now) {
    return { ok: false, error: "Your wristband is still recharging." };
  }

  player.zapCooldownUntil = now + DARKNESS_ZAP_COOLDOWN_MS;
  const target = nearestZapTarget(world, player, now);
  if (!target) {
    world.events.unshift({
      id: `darkness-zap-miss-${now}`,
      kind: "zap",
      message: `${player.name} zapped the darkness.`,
      createdAt: now
    });
    return { ok: true, value: "Zap fired, but nobody was in range." };
  }

  if (target.shieldActiveUntil > now) {
    world.events.unshift({
      id: `darkness-zap-blocked-${now}`,
      kind: "zap",
      message: `${target.name}'s shield blocked ${player.name}'s zap.`,
      createdAt: now
    });
    world.updatedAt = now;
    return { ok: true, value: "Zap blocked by shield." };
  }

  target.stunnedUntil = now + DARKNESS_STUN_MS;
  world.events.unshift({
    id: `darkness-zap-${now}`,
    kind: "zap",
    message: `${player.name} stunned ${target.name}.`,
    createdAt: now
  });
  world.updatedAt = now;
  return { ok: true, value: `${target.name} stunned.` };
}

export function activateDarknessShield(
  world: DarknessWorldState,
  playerId: string,
  now = Date.now()
): ApplyResult<DarknessPlayerState> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this Darkness room." };
  }
  if (world.winnerPlayerId) {
    return { ok: false, error: "The round is already over." };
  }
  if (player.shieldCooldownUntil > now) {
    return { ok: false, error: "Shield is still recharging." };
  }
  player.shieldActiveUntil = now + DARKNESS_SHIELD_DURATION_MS;
  player.shieldCooldownUntil = now + DARKNESS_SHIELD_COOLDOWN_MS;
  world.events.unshift({
    id: `darkness-shield-${now}`,
    kind: "shield",
    message: `${player.name} activated a shield.`,
    createdAt: now
  });
  world.updatedAt = now;
  return { ok: true, value: player };
}

export function buyDarknessHouse(world: DarknessWorldState, playerId: string, now = Date.now()): ApplyResult<DarknessWorldState> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this Darkness room." };
  }
  if (world.winnerPlayerId) {
    return { ok: false, error: "The house has already been bought." };
  }
  if (distance(player.position, world.house.position) > DARKNESS_HOUSE_RADIUS + 18) {
    return { ok: false, error: "Stand by the house sign to buy it." };
  }
  if (player.coins < world.house.price) {
    return { ok: false, error: `You need ${world.house.price} coins to buy this house.` };
  }
  player.coins -= world.house.price;
  world.house.ownerPlayerId = player.id;
  world.winnerPlayerId = player.id;
  world.events.unshift({
    id: `darkness-house-${now}`,
    kind: "house",
    message: `${player.name} bought the house and survived the darkness.`,
    createdAt: now
  });
  world.updatedAt = now;
  return { ok: true, value: world };
}

export function tickDarknessWorld(world: DarknessWorldState, now = Date.now()): DarknessWorldState {
  const oldPhase = world.dayNight.phase;
  world.dayNight = nextDarknessDayNightState(world, now);
  if (oldPhase !== world.dayNight.phase) {
    world.events.unshift({
      id: `darkness-phase-${now}`,
      kind: "phase",
      message: world.dayNight.phase === "night" ? "Night has fallen." : "Morning is back.",
      createdAt: now
    });
  }
  ensureMinimumDarknessCoinSupply(world, now);
  world.updatedAt = now;
  return world;
}

export function collectNearbyCoins(
  world: DarknessWorldState,
  player: DarknessPlayerState,
  now = Date.now()
): number {
  let collected = 0;
  world.coins = world.coins.filter((coin) => {
    if (distance(player.position, coin.position) <= DARKNESS_COIN_PICKUP_RADIUS) {
      player.coins += coin.value;
      collected += coin.value;
      return false;
    }
    return true;
  });
  if (collected > 0) {
    world.events.unshift({
      id: `darkness-coin-${now}-${player.id}`,
      kind: "coin",
      message: `${player.name} found ${collected} coin${collected === 1 ? "" : "s"}.`,
      createdAt: now
    });
  }
  return collected;
}

export function forceDarknessPhase(
  world: DarknessWorldState,
  phase: "morning" | "night",
  now = Date.now()
): DarknessWorldState {
  const next = cloneDarknessWorld(world);
  next.dayNight = {
    phase,
    phaseStartedAt: now,
    phaseEndsAt: now + (phase === "morning" ? 120_000 : DARKNESS_NIGHT_DURATION_MS),
    nightCount: phase === "night" ? world.dayNight.nightCount + 1 : world.dayNight.nightCount
  };
  return next;
}

function nearestZapTarget(
  world: DarknessWorldState,
  player: DarknessPlayerState,
  now: number
): DarknessPlayerState | undefined {
  return Object.values(world.players)
    .filter((target) => target.id !== player.id)
    .filter((target) => target.stunnedUntil <= now)
    .filter((target) => distance(target.position, player.position) <= DARKNESS_ZAP_RANGE)
    .sort((a, b) => distance(a.position, player.position) - distance(b.position, player.position))[0];
}

function clampPosition(position: DarknessVec2): DarknessVec2 {
  return {
    x: Math.max(24, Math.min(DARKNESS_WORLD_SIZE.width - 24, position.x)),
    y: Math.max(24, Math.min(DARKNESS_WORLD_SIZE.height - 24, position.y))
  };
}

function ensureMinimumDarknessCoinSupply(world: DarknessWorldState, now: number): void {
  if (world.winnerPlayerId) {
    return;
  }

  const minimumTotal = world.house.price * 2 + 20;
  const currentTotal =
    world.coins.reduce((sum, coin) => sum + coin.value, 0) +
    Object.values(world.players).reduce((sum, player) => sum + player.coins, 0);
  let needed = minimumTotal - currentTotal;
  if (needed <= 0) {
    return;
  }

  let added = 0;
  let index = 0;
  while (needed > 0) {
    const value = Math.min(2, needed);
    world.coins.push({
      id: `catchup-${now}-${index}`,
      position: catchupCoinPosition(world, world.coins.length + index),
      value
    });
    needed -= value;
    added += value;
    index += 1;
  }
  world.events.unshift({
    id: `darkness-catchup-coins-${now}`,
    kind: "coin",
    message: `${added} more coin${added === 1 ? "" : "s"} glimmered in the cave.`,
    createdAt: now
  });
}

function catchupCoinPosition(world: DarknessWorldState, index: number): DarknessVec2 {
  const angle = index * 2.399963229728653 + world.code.length;
  const radius = 92 + (index % 7) * 21;
  return clampPosition({
    x: world.house.position.x + Math.cos(angle) * radius,
    y: world.house.position.y + Math.sin(angle) * radius
  });
}

function distance(a: DarknessVec2, b: DarknessVec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
