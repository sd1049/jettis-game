import {
  DAY_DURATION_MS,
  NIGHT_DURATION_MS,
  STARTING_JETPACK_CHARGE,
  WORLD_SIZE
} from "./constants.js";
import { blockKey, topBlockY } from "./blocks.js";
import type {
  BlockCell,
  BlockType,
  FoodNodeState,
  GearLoadout,
  Inventory,
  PlayerAppearance,
  PlayerState,
  SupplyCrateState,
  Vec3,
  VillagerState,
  WorldState
} from "./types.js";

export function createInitialWorld(code: string, now = Date.now()): WorldState {
  const blocks: Record<string, BlockCell> = {};

  for (let x = 0; x < WORLD_SIZE.width; x += 1) {
    for (let z = 0; z < WORLD_SIZE.depth; z += 1) {
      const dx = x - WORLD_SIZE.width / 2;
      const dz = z - WORLD_SIZE.depth / 2;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const islandEdge = WORLD_SIZE.width / 2 - 4;

      if (distance > islandEdge) {
        continue;
      }

      const ridge = Math.sin(x * 0.24) * 1.6 + Math.cos(z * 0.19) * 1.4;
      const height = Math.max(2, Math.min(7, Math.floor(4 + ridge - distance / 20)));
      const lake = distance < 7 && x > 27 && x < 38 && z > 27 && z < 38;
      const lavaCrack = x > 47 && x < 51 && z > 14 && z < 31;

      for (let y = 0; y <= height; y += 1) {
        let type: BlockType = y === height ? "grass" : y > height - 3 ? "dirt" : "stone";
        if (lake && y >= height - 1) {
          type = y === height ? "water" : "dirt";
        }
        if (lavaCrack && y === height) {
          type = "lava";
        }
        blocks[blockKey({ x, y, z })] = { type };
      }

      if ((x === 18 && z === 18) || (x === 20 && z === 19) || (x === 17 && z === 21)) {
        const treeY = height + 1;
        blocks[blockKey({ x, y: treeY, z })] = { type: "wood" };
        blocks[blockKey({ x, y: treeY + 1, z })] = { type: "wood" };
        for (let lx = -1; lx <= 1; lx += 1) {
          for (let lz = -1; lz <= 1; lz += 1) {
            blocks[blockKey({ x: x + lx, y: treeY + 2, z: z + lz })] = { type: "leaves" };
          }
        }
      }
    }
  }

  seedStarterSafeHouse(blocks);

  return {
    code,
    version: 1,
    size: WORLD_SIZE,
    blocks,
    players: {},
    creatures: [],
    hazards: [
      { id: "lava-warning-1", kind: "lava_spark", position: { x: 49, y: 7, z: 22 }, radius: 3 }
    ],
    villagers: createVillagers(blocks),
    crates: createSupplyCrates(blocks),
    foodNodes: createFoodNodes(blocks, now),
    trades: {},
    dayNight: {
      phase: "day",
      phaseStartedAt: now,
      phaseEndsAt: now + DAY_DURATION_MS,
      nightCount: 0
    },
    events: [],
    victory: {
      flagPlaced: false,
      bossDefeated: false
    },
    updatedAt: now
  };
}

function seedStarterSafeHouse(blocks: Record<string, BlockCell>): void {
  const minX = 8;
  const minZ = 8;
  const maxX = 14;
  const maxZ = 14;
  const floorY = 7;

  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      blocks[blockKey({ x, y: floorY, z })] = { type: "wood" };
      blocks[blockKey({ x, y: floorY + 4, z })] = { type: "wood" };
      const wall = x === minX || x === maxX || z === minZ || z === maxZ;
      if (wall) {
        for (let y = floorY + 1; y <= floorY + 3; y += 1) {
          blocks[blockKey({ x, y, z })] = { type: y === floorY + 2 ? "glass" : "wood" };
        }
      }
    }
  }
  blocks[blockKey({ x: 11, y: floorY + 1, z: minZ })] = { type: "door" };
  blocks[blockKey({ x: 11, y: floorY + 2, z: minZ })] = { type: "door" };
  blocks[blockKey({ x: 12, y: floorY + 3, z: 12 })] = { type: "light" };
}

function createVillagers(blocks: Record<string, BlockCell>): VillagerState[] {
  return [
    {
      id: "villager-mara",
      name: "Mara",
      position: onTop(blocks, 22, 15),
      line: "Storms get loud at night. A roof and lights make a cozy base."
    },
    {
      id: "villager-ren",
      name: "Ren",
      position: onTop(blocks, 25, 18),
      line: "The lake has fish. The lava crack has trouble. Choose wisely."
    }
  ];
}

function createSupplyCrates(blocks: Record<string, BlockCell>): SupplyCrateState[] {
  return [
    {
      id: "crate-boost-1",
      position: onTop(blocks, 42, 42),
      inventory: { booster: 2, glass: 8, light: 3 },
      openedBy: []
    },
    {
      id: "crate-food-1",
      position: onTop(blocks, 19, 43),
      inventory: { berries: 4, seed: 3, wood: 10 },
      openedBy: []
    },
    {
      id: "crate-flag-1",
      position: onTop(blocks, 52, 36),
      inventory: { victory_flag: 1, pack_turbo: 1 },
      openedBy: []
    }
  ];
}

function createFoodNodes(blocks: Record<string, BlockCell>, now: number): FoodNodeState[] {
  return [
    { id: "berries-1", kind: "berry_bush", position: onTop(blocks, 16, 30), readyAt: now },
    { id: "berries-2", kind: "berry_bush", position: onTop(blocks, 27, 46), readyAt: now },
    { id: "fish-1", kind: "fishing_spot", position: { x: 32, y: topBlockY({ blocks }, 32, 32) + 1, z: 32 }, readyAt: now },
    { id: "garden-1", kind: "garden_plot", position: onTop(blocks, 13, 17), readyAt: now }
  ];
}

function onTop(blocks: Record<string, BlockCell>, x: number, z: number): Vec3 {
  return { x, y: topBlockY({ blocks }, x, z) + 1, z };
}

export function createDefaultGear(): GearLoadout {
  return {
    helmet: "cap",
    blaster: "sprayer",
    pack: "starter",
    packColor: "#3ea7ff",
    waterRange: 5,
    jetpackChargeMax: STARTING_JETPACK_CHARGE,
    speedMode: "easy"
  };
}

export function createDefaultAppearance(seed = "player"): PlayerAppearance {
  const palette = stringHash(seed) % 3;
  if (palette === 0) {
    return { bodyColor: "#f1b88d", shirtColor: "#2c7be5", pantsColor: "#2b3440", accentColor: "#f7c948" };
  }
  if (palette === 1) {
    return { bodyColor: "#d59b72", shirtColor: "#5fbb68", pantsColor: "#263238", accentColor: "#ff8a4c" };
  }
  return { bodyColor: "#b9825f", shirtColor: "#d85555", pantsColor: "#3e4a61", accentColor: "#8fd6ff" };
}

export function createPlayer(id: string, name: string, world: WorldState, now = Date.now()): PlayerState {
  const safeStart = { x: 11, y: 8, z: 11 };
  const gear = createDefaultGear();
  return {
    id,
    name,
    appearance: createDefaultAppearance(name),
    gear,
    inventory: createStartingInventory(),
    position: safeStart,
    rotationY: 0,
    health: 100,
    hunger: 100,
    jetpackCharge: gear.jetpackChargeMax,
    isFlying: false,
    isSafe: true,
    lastSeenAt: now
  };
}

export function createStartingInventory(): Inventory {
  return {
    dirt: 24,
    wood: 24,
    glass: 8,
    ladder: 6,
    light: 3,
    berries: 3,
    water_cell: 10
  };
}

function stringHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

export function nextDayNightState(world: WorldState, now = Date.now()): WorldState["dayNight"] {
  const current = world.dayNight;
  if (now < current.phaseEndsAt) {
    return current;
  }

  if (current.phase === "day") {
    return {
      phase: "night",
      phaseStartedAt: now,
      phaseEndsAt: now + NIGHT_DURATION_MS,
      nightCount: current.nightCount + 1
    };
  }

  return {
    phase: "day",
    phaseStartedAt: now,
    phaseEndsAt: now + DAY_DURATION_MS,
    nightCount: current.nightCount
  };
}
