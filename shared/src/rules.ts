import { DAY_DURATION_MS, ITEM_IDS, MAX_PLAYERS_PER_WORLD, NIGHT_DURATION_MS, WORLD_SIZE } from "./constants.js";
import {
  adjacentPositions,
  blockKey,
  getBlock,
  inWorldBounds,
  isAir,
  isSafeHouseBlock,
  isSolidBlock,
  parseBlockKey
} from "./blocks.js";
import { cloneWorld, createPlayer, nextDayNightState } from "./world.js";
import type {
  ApplyResult,
  EditBlockRequest,
  Inventory,
  ItemId,
  PlayerInputState,
  PlayerState,
  TradeState,
  UseToolRequest,
  Vec3,
  WorldState
} from "./types.js";

export function addPlayerToWorld(
  world: WorldState,
  playerId: string,
  name: string,
  now = Date.now()
): ApplyResult<PlayerState> {
  const existing = Object.values(world.players).find((player) => player.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.lastSeenAt = now;
    return { ok: true, value: existing };
  }

  if (Object.keys(world.players).length >= MAX_PLAYERS_PER_WORLD) {
    return { ok: false, error: "This world is already full for the two-player vertical slice." };
  }

  const player = createPlayer(playerId, name, world, now);
  world.players[player.id] = player;
  world.updatedAt = now;
  return { ok: true, value: player };
}

export function applyPlayerInput(
  world: WorldState,
  playerId: string,
  input: PlayerInputState,
  deltaMs: number,
  now = Date.now()
): ApplyResult<PlayerState> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this world." };
  }

  const chargeRate = 20 * (deltaMs / 1000);
  const flyDrainByMode = { easy: 16, medium: 26, turbo: 42 } as const;
  const moveSpeedByMode = { easy: 3.1, medium: 4.4, turbo: 6.2 } as const;
  const baseSpeed = moveSpeedByMode[player.gear.speedMode] * (input.sprint ? 1.25 : 1);
  const seconds = deltaMs / 1000;

  let next: Vec3;
  if (input.tapTarget) {
    next = moveToward(player.position, input.tapTarget, baseSpeed * seconds);
  } else {
    next = {
      x: player.position.x + input.moveX * baseSpeed * seconds,
      y: player.position.y,
      z: player.position.z + input.moveZ * baseSpeed * seconds
    };
  }

  if (input.fly && player.jetpackCharge > 0) {
    player.isFlying = true;
    player.jetpackCharge = Math.max(0, player.jetpackCharge - flyDrainByMode[player.gear.speedMode] * seconds);
    next.y += 4.4 * seconds;
  } else if (input.descend && player.isFlying) {
    next.y -= 4.2 * seconds;
  } else if (!player.isFlying) {
    const groundY = groundHeightAt(world, next.x, next.z, Math.floor(player.position.y)) + 1;
    next.y = Math.max(next.y - 8 * seconds, groundY);
  } else {
    player.jetpackCharge = Math.min(player.gear.jetpackChargeMax, player.jetpackCharge + chargeRate * 0.25);
  }

  if (!input.fly && !input.descend && player.isFlying) {
    player.jetpackCharge = Math.min(player.gear.jetpackChargeMax, player.jetpackCharge + chargeRate * 0.1);
  }

  if (player.jetpackCharge <= 0 && next.y > groundHeightAt(world, next.x, next.z) + 1) {
    next.y -= 3.5 * seconds;
  }

  next = clampPlayerPosition(world, next);
  player.position = next;
  player.rotationY = input.lookY;
  player.isSafe = isPositionInSafeHouse(world, next);
  player.hunger = Math.max(0, player.hunger - 0.45 * seconds);
  player.health = player.hunger <= 0 ? Math.max(1, player.health - 1.5 * seconds) : player.health;
  player.lastSeenAt = now;
  world.updatedAt = now;
  return { ok: true, value: player };
}

export function applyBlockEdit(
  world: WorldState,
  playerId: string,
  request: EditBlockRequest,
  now = Date.now()
): ApplyResult<WorldState> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this world." };
  }

  const position = request.position;
  if (!inWorldBounds(position)) {
    return { ok: false, error: "That block is outside the island boundary." };
  }

  const key = blockKey(position);
  const existing = world.blocks[key];
  const distance = distance3(player.position, position);
  if (distance > 8.5) {
    return { ok: false, error: "Move closer before editing that block." };
  }

  if (request.action === "break") {
    if (!existing) {
      return { ok: false, error: "There is no block there to break." };
    }
    if (existing.type === "water" || existing.type === "lava") {
      return { ok: false, error: "Use tools around water and lava instead of picking them up." };
    }
    delete world.blocks[key];
    addInventory(player.inventory, existing.type, 1);
    world.updatedAt = now;
    return { ok: true, value: world };
  }

  if (!request.blockType) {
    return { ok: false, error: "Choose a block type to place." };
  }
  if (!isAir(world, position)) {
    return { ok: false, error: "That space is already occupied." };
  }
  if (!hasInventory(player.inventory, request.blockType, 1)) {
    return { ok: false, error: `You need ${request.blockType} to place that block.` };
  }
  if (!adjacentPositions(position).some((adjacent) => isSolidBlock(getBlock(world, adjacent)))) {
    return { ok: false, error: "Placed blocks need to touch another solid block." };
  }

  consumeInventory(player.inventory, request.blockType, 1);
  world.blocks[key] = { type: request.blockType, placedBy: playerId };
  world.updatedAt = now;
  return { ok: true, value: world };
}

export function applyToolUse(
  world: WorldState,
  playerId: string,
  request: UseToolRequest,
  now = Date.now()
): ApplyResult<WorldState> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this world." };
  }
  if (distance3(player.position, request.target) > Math.max(player.gear.waterRange, 3)) {
    return { ok: false, error: "That target is out of range." };
  }

  if (request.tool === "water") {
    world.creatures = world.creatures.map((creature) => {
      if (distance3(creature.position, request.target) <= 2.5) {
        return { ...creature, health: Math.max(0, creature.health - 35) };
      }
      return creature;
    });
    world.creatures = world.creatures.filter((creature) => creature.health > 0);
    world.hazards = world.hazards.filter((hazard) => {
      const cleared = hazard.kind === "quicksand" && distance3(hazard.position, request.target) <= 2.5;
      return !cleared;
    });
    world.events.unshift({
      id: `event-${now}`,
      kind: "water_spray",
      message: `${player.name} sprayed water to clear danger.`,
      createdAt: now
    });
    world.updatedAt = now;
    return { ok: true, value: world };
  }

  if (request.tool === "fish") {
    const fishingSpot = world.foodNodes.find(
      (node) => node.kind === "fishing_spot" && distance3(node.position, request.target) <= 3 && node.readyAt <= now
    );
    if (!fishingSpot) {
      return { ok: false, error: "Find the lake fishing spot before fishing." };
    }
    addInventory(player.inventory, "fish", 1);
    fishingSpot.readyAt = now + 30_000;
    world.updatedAt = now;
    return { ok: true, value: world };
  }

  if (request.tool === "gather") {
    const foodNode = world.foodNodes.find((node) => distance3(node.position, request.target) <= 3 && node.readyAt <= now);
    if (!foodNode) {
      return { ok: false, error: "Nothing is ready to gather here yet." };
    }
    addInventory(player.inventory, foodNode.kind === "berry_bush" ? "berries" : "seed", foodNode.kind === "garden_plot" ? 2 : 1);
    foodNode.readyAt = now + 45_000;
    world.updatedAt = now;
    return { ok: true, value: world };
  }

  if (request.tool === "victory_flag") {
    if (!hasInventory(player.inventory, "victory_flag", 1)) {
      return { ok: false, error: "Find the victory flag crate first." };
    }
    if (player.position.y < 25) {
      return { ok: false, error: "The victory flag belongs on a sky tower." };
    }
    world.victory.flagPlaced = true;
    if (!world.creatures.some((creature) => creature.kind === "storm_boss")) {
      world.creatures.push({
        id: `storm-boss-${now}`,
        kind: "storm_boss",
        position: { x: Math.round(player.position.x + 4), y: Math.round(player.position.y), z: Math.round(player.position.z + 4) },
        health: 160,
        nextActionAt: now + 1500
      });
    }
    world.events.unshift({
      id: `event-${now}`,
      kind: "tower_flag_ready",
      message: "The sky flag is up. Defend the tower from the storm boss!",
      createdAt: now
    });
    world.updatedAt = now;
    return { ok: true, value: world };
  }

  return { ok: false, error: "Unknown tool." };
}

export function interactWithTarget(
  world: WorldState,
  playerId: string,
  targetKind: "villager" | "crate" | "food",
  targetId: string,
  now = Date.now()
): ApplyResult<string> {
  const player = world.players[playerId];
  if (!player) {
    return { ok: false, error: "Player is not in this world." };
  }

  if (targetKind === "villager") {
    const villager = world.villagers.find((candidate) => candidate.id === targetId);
    if (!villager || distance3(player.position, villager.position) > 5) {
      return { ok: false, error: "Move closer to talk." };
    }
    return { ok: true, value: `${villager.name}: ${villager.line}` };
  }

  if (targetKind === "crate") {
    const crate = world.crates.find((candidate) => candidate.id === targetId);
    if (!crate || distance3(player.position, crate.position) > 5) {
      return { ok: false, error: "Move closer to open the crate." };
    }
    if (crate.openedBy.includes(playerId)) {
      return { ok: false, error: "You already opened this crate." };
    }
    mergeInventory(player.inventory, crate.inventory);
    crate.openedBy.push(playerId);
    const boosters = crate.inventory.booster ?? 0;
    if (boosters > 0) {
      player.gear.jetpackChargeMax += boosters * 25;
      player.jetpackCharge = player.gear.jetpackChargeMax;
      player.gear.waterRange += boosters;
    }
    if ((crate.inventory.pack_turbo ?? 0) > 0) {
      player.gear.speedMode = "turbo";
      player.gear.pack = "wing_pack";
    }
    world.updatedAt = now;
    return { ok: true, value: "Supply crate opened." };
  }

  if (targetKind === "food") {
    const node = world.foodNodes.find((candidate) => candidate.id === targetId);
    if (!node || distance3(player.position, node.position) > 5 || node.readyAt > now) {
      return { ok: false, error: "This food spot is not ready." };
    }
    const item: ItemId = node.kind === "fishing_spot" ? "fish" : node.kind === "garden_plot" ? "seed" : "berries";
    addInventory(player.inventory, item, node.kind === "garden_plot" ? 2 : 1);
    node.readyAt = now + 45_000;
    world.updatedAt = now;
    return { ok: true, value: `${item} collected.` };
  }

  return { ok: false, error: "Unknown interaction." };
}

export function startTrade(world: WorldState, playerAId: string, playerBId: string, now = Date.now()): ApplyResult<TradeState> {
  const playerA = world.players[playerAId];
  const playerB = world.players[playerBId];
  if (!playerA || !playerB) {
    return { ok: false, error: "Both players must be in the world to trade." };
  }
  if (distance3(playerA.position, playerB.position) > 6) {
    return { ok: false, error: "Stand closer together to trade." };
  }

  const trade: TradeState = {
    id: `trade-${now}-${playerAId.slice(0, 5)}`,
    worldCode: world.code,
    playerAId,
    playerBId,
    offers: {
      [playerAId]: { playerId: playerAId, items: {}, accepted: false },
      [playerBId]: { playerId: playerBId, items: {}, accepted: false }
    },
    status: "pending",
    updatedAt: now
  };
  world.trades[trade.id] = trade;
  return { ok: true, value: trade };
}

export function updateTradeOffer(
  world: WorldState,
  playerId: string,
  tradeId: string,
  items: Inventory,
  now = Date.now()
): ApplyResult<TradeState> {
  const trade = world.trades[tradeId];
  const player = world.players[playerId];
  if (!trade || trade.status !== "pending" || !player || !trade.offers[playerId]) {
    return { ok: false, error: "Trade is no longer available." };
  }
  for (const [item, count] of Object.entries(items) as [ItemId, number][]) {
    if (!ITEM_IDS.includes(item) || count < 0 || !hasInventory(player.inventory, item, count)) {
      return { ok: false, error: "Your offer contains items you do not have." };
    }
  }
  trade.offers[playerId] = { playerId, items, accepted: false };
  Object.keys(trade.offers).forEach((offerPlayerId) => {
    if (offerPlayerId !== playerId) {
      trade.offers[offerPlayerId]!.accepted = false;
    }
  });
  trade.updatedAt = now;
  return { ok: true, value: trade };
}

export function acceptTrade(world: WorldState, playerId: string, tradeId: string, now = Date.now()): ApplyResult<TradeState> {
  const trade = world.trades[tradeId];
  if (!trade || trade.status !== "pending" || !trade.offers[playerId]) {
    return { ok: false, error: "Trade is no longer available." };
  }
  trade.offers[playerId]!.accepted = true;
  trade.updatedAt = now;

  const offers = Object.values(trade.offers);
  if (!offers.every((offer) => offer.accepted)) {
    return { ok: true, value: trade };
  }

  const [offerA, offerB] = offers;
  if (!offerA || !offerB) {
    return { ok: false, error: "Trade is missing an offer." };
  }
  const playerA = world.players[offerA.playerId];
  const playerB = world.players[offerB.playerId];
  if (!playerA || !playerB) {
    return { ok: false, error: "Both players must still be connected." };
  }
  if (!inventoryCanCover(playerA.inventory, offerA.items) || !inventoryCanCover(playerB.inventory, offerB.items)) {
    trade.status = "cancelled";
    return { ok: false, error: "One player no longer has the offered items." };
  }

  subtractInventory(playerA.inventory, offerA.items);
  subtractInventory(playerB.inventory, offerB.items);
  mergeInventory(playerA.inventory, offerB.items);
  mergeInventory(playerB.inventory, offerA.items);
  trade.status = "completed";
  world.updatedAt = now;
  return { ok: true, value: trade };
}

export function tickWorld(world: WorldState, now = Date.now()): WorldState {
  const next = world;
  const priorPhase = next.dayNight.phase;
  next.dayNight = nextDayNightState(next, now);

  for (const player of Object.values(next.players)) {
    player.isSafe = isPositionInSafeHouse(next, player.position);
    if (player.isSafe) {
      player.health = Math.min(100, player.health + 0.4);
      player.jetpackCharge = Math.min(player.gear.jetpackChargeMax, player.jetpackCharge + 2);
    }
  }

  if (priorPhase !== next.dayNight.phase && next.dayNight.phase === "night") {
    spawnNightCreatures(next, now);
  }

  if (next.dayNight.phase === "day") {
    next.creatures = next.creatures.filter((creature) => creature.kind === "storm_boss");
    next.hazards = next.hazards.filter((hazard) => hazard.kind !== "quicksand" || (hazard.expiresAt ?? 0) > now);
  } else {
    moveCreatures(next, now);
  }

  if (next.victory.flagPlaced) {
    const boss = next.creatures.find((creature) => creature.kind === "storm_boss");
    if (!boss && !next.victory.bossDefeated) {
      next.victory.bossDefeated = true;
      next.victory.wonAt = now;
      next.events.unshift({
        id: `victory-${now}`,
        kind: "victory",
        message: "Victory! The sky fortress is safe.",
        createdAt: now
      });
    }
  }

  next.updatedAt = now;
  return next;
}

export function isPositionInSafeHouse(world: WorldState, position: Vec3): boolean {
  const x = Math.round(position.x);
  const y = Math.floor(position.y);
  const z = Math.round(position.z);

  const floorSafe = isSafeHouseBlock(getBlock(world, { x, y: y - 1, z })) || isSolidBlock(getBlock(world, { x, y: y - 1, z }));
  if (!floorSafe) {
    return false;
  }

  let roof = false;
  for (let roofY = y + 2; roofY <= Math.min(y + 6, WORLD_SIZE.height - 1); roofY += 1) {
    if (isSafeHouseBlock(getBlock(world, { x, y: roofY, z }))) {
      roof = true;
      break;
    }
  }
  if (!roof) {
    return false;
  }

  const directions = [
    { dx: 1, dz: 0 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
    { dx: 0, dz: -1 }
  ];

  return directions.every(({ dx, dz }) => {
    for (let distance = 1; distance <= 5; distance += 1) {
      const check = { x: x + dx * distance, y, z: z + dz * distance };
      const block = getBlock(world, check);
      if (isSafeHouseBlock(block)) {
        return true;
      }
    }
    return false;
  });
}

export function hasInventory(inventory: Inventory, item: ItemId, count: number): boolean {
  return (inventory[item] ?? 0) >= count;
}

export function addInventory(inventory: Inventory, item: ItemId, count: number): void {
  inventory[item] = (inventory[item] ?? 0) + count;
}

export function consumeInventory(inventory: Inventory, item: ItemId, count: number): boolean {
  if (!hasInventory(inventory, item, count)) {
    return false;
  }
  inventory[item] = Math.max(0, (inventory[item] ?? 0) - count);
  if (inventory[item] === 0) {
    delete inventory[item];
  }
  return true;
}

export function mergeInventory(target: Inventory, source: Inventory): void {
  for (const [item, count] of Object.entries(source) as [ItemId, number][]) {
    addInventory(target, item, count);
  }
}

export function subtractInventory(target: Inventory, source: Inventory): boolean {
  if (!inventoryCanCover(target, source)) {
    return false;
  }
  for (const [item, count] of Object.entries(source) as [ItemId, number][]) {
    consumeInventory(target, item, count);
  }
  return true;
}

export function inventoryCanCover(inventory: Inventory, source: Inventory): boolean {
  return (Object.entries(source) as [ItemId, number][]).every(([item, count]) => hasInventory(inventory, item, count));
}

function spawnNightCreatures(world: WorldState, now: number): void {
  if (world.creatures.some((creature) => creature.kind === "shadow_splasher")) {
    return;
  }
  const spawnPoints = [
    { x: 18, y: 8, z: 46 },
    { x: 45, y: 7, z: 16 },
    { x: 49, y: 8, z: 40 }
  ];
  for (const [index, point] of spawnPoints.entries()) {
    world.creatures.push({
      id: `shadow-${world.dayNight.nightCount}-${index}`,
      kind: "shadow_splasher",
      position: point,
      health: 70,
      nextActionAt: now + 2000 + index * 800
    });
  }
}

function moveCreatures(world: WorldState, now: number): void {
  for (const creature of world.creatures) {
    if (now < creature.nextActionAt) {
      continue;
    }
    const target = nearestUnsafePlayer(world, creature.position);
    if (!target) {
      creature.nextActionAt = now + 1500;
      continue;
    }
    creature.targetPlayerId = target.id;
    creature.position = moveToward(creature.position, target.position, creature.kind === "storm_boss" ? 1.25 : 0.75);
    creature.position.y = Math.max(groundHeightAt(world, creature.position.x, creature.position.z) + 1, creature.position.y);
    if (creature.kind === "shadow_splasher" && distance3(creature.position, target.position) < 4) {
      const hazardPosition = {
        x: Math.round(target.position.x),
        y: Math.max(1, Math.round(target.position.y - 1)),
        z: Math.round(target.position.z)
      };
      world.hazards.push({
        id: `quicksand-${now}-${creature.id}`,
        kind: "quicksand",
        position: hazardPosition,
        radius: 1.8,
        expiresAt: now + 60_000
      });
      if (!target.isSafe) {
        target.health = Math.max(5, target.health - 4);
      }
    }
    if (creature.kind === "storm_boss" && distance3(creature.position, target.position) < 5 && !target.isSafe) {
      target.health = Math.max(1, target.health - 8);
    }
    creature.nextActionAt = now + (creature.kind === "storm_boss" ? 1200 : 2400);
  }
}

function nearestUnsafePlayer(world: WorldState, from: Vec3): PlayerState | undefined {
  return Object.values(world.players)
    .filter((player) => !player.isSafe)
    .sort((a, b) => distance3(a.position, from) - distance3(b.position, from))[0];
}

function clampPlayerPosition(world: WorldState, position: Vec3): Vec3 {
  const x = Math.max(1, Math.min(WORLD_SIZE.width - 2, position.x));
  const z = Math.max(1, Math.min(WORLD_SIZE.depth - 2, position.z));
  const minY = groundHeightAt(world, x, z, Math.floor(position.y)) + 1;
  const y = Math.max(minY, Math.min(WORLD_SIZE.height - 0.5, position.y));
  return { x, y, z };
}

function groundHeightAt(world: WorldState, rawX: number, rawZ: number, maxY = WORLD_SIZE.height - 1): number {
  const x = Math.max(0, Math.min(WORLD_SIZE.width - 1, Math.round(rawX)));
  const z = Math.max(0, Math.min(WORLD_SIZE.depth - 1, Math.round(rawZ)));
  let highest = 0;
  for (const key of Object.keys(world.blocks)) {
    const position = parseBlockKey(key as `${number},${number},${number}`);
    if (
      position.x === x &&
      position.z === z &&
      position.y <= maxY &&
      isSolidBlock(world.blocks[key as `${number},${number},${number}`]?.type)
    ) {
      highest = Math.max(highest, position.y);
    }
  }
  return highest;
}

function moveToward(from: Vec3, to: Vec3, distance: number): Vec3 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length === 0 || length <= distance) {
    return { ...to };
  }
  const scale = distance / length;
  return {
    x: from.x + dx * scale,
    y: from.y + dy * scale,
    z: from.z + dz * scale
  };
}

function distance3(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function forcePhase(world: WorldState, phase: "day" | "night", now = Date.now()): WorldState {
  const next = cloneWorld(world);
  next.dayNight = {
    phase,
    phaseStartedAt: now,
    phaseEndsAt: now + (phase === "day" ? DAY_DURATION_MS : NIGHT_DURATION_MS),
    nightCount: phase === "night" ? world.dayNight.nightCount + 1 : world.dayNight.nightCount
  };
  return next;
}
