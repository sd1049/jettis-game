import {
  DARKNESS_COIN_COUNT,
  DARKNESS_DAY_DURATION_MS,
  DARKNESS_HOUSE_PRICE,
  DARKNESS_HOUSE_RADIUS,
  DARKNESS_WORLD_SIZE
} from "./darknessConstants.js";
import type {
  DarknessCave,
  DarknessCoin,
  DarknessPlayerState,
  DarknessVec2,
  DarknessWorldState
} from "./darknessTypes.js";

const PLAYER_COLORS = ["#e24d4d", "#2f8fe8", "#47aa5b", "#f2b43d", "#9b69d8", "#e66fa8"];
const WRISTBAND_COLORS = ["#8ff0ff", "#fff278", "#b8ff8f", "#ff9ee6", "#bba3ff", "#ffb57a"];

export function createInitialDarknessWorld(code: string, now = Date.now()): DarknessWorldState {
  const random = createSeededRandom(code);
  const caves = createCaves(random);
  const housePosition = createHousePosition(random);
  return {
    code,
    version: 1,
    size: DARKNESS_WORLD_SIZE,
    players: {},
    coins: createCoins(random, caves, housePosition),
    caves,
    house: {
      id: "house-1",
      position: housePosition,
      radius: DARKNESS_HOUSE_RADIUS,
      price: DARKNESS_HOUSE_PRICE
    },
    dayNight: {
      phase: "morning",
      phaseStartedAt: now,
      phaseEndsAt: now + DARKNESS_DAY_DURATION_MS,
      nightCount: 0
    },
    events: [],
    updatedAt: now
  };
}

export function createDarknessPlayer(
  id: string,
  name: string,
  world: DarknessWorldState,
  now = Date.now()
): DarknessPlayerState {
  const index = Object.keys(world.players).length;
  const cave = world.caves[index % world.caves.length] ?? world.caves[0]!;
  return {
    id,
    name,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length]!,
    wristbandColor: WRISTBAND_COLORS[index % WRISTBAND_COLORS.length]!,
    position: {
      x: cave.position.x + (index % 2 === 0 ? -22 : 22),
      y: cave.position.y + (index % 3 === 0 ? -18 : 18)
    },
    coins: 0,
    stunnedUntil: 0,
    zapCooldownUntil: 0,
    shieldActiveUntil: 0,
    shieldCooldownUntil: 0,
    lastSeenAt: now
  };
}

export function cloneDarknessWorld(world: DarknessWorldState): DarknessWorldState {
  return JSON.parse(JSON.stringify(world)) as DarknessWorldState;
}

export function nextDarknessDayNightState(
  world: DarknessWorldState,
  now = Date.now()
): DarknessWorldState["dayNight"] {
  const current = world.dayNight;
  if (now < current.phaseEndsAt) {
    return current;
  }
  if (current.phase === "morning") {
    return {
      phase: "night",
      phaseStartedAt: now,
      phaseEndsAt: now + 90_000,
      nightCount: current.nightCount + 1
    };
  }
  return {
    phase: "morning",
    phaseStartedAt: now,
    phaseEndsAt: now + DARKNESS_DAY_DURATION_MS,
    nightCount: current.nightCount
  };
}

function createCaves(random: () => number): DarknessCave[] {
  return [
    {
      id: "cave-west",
      position: { x: randomRange(random, 96, 180), y: randomRange(random, 270, 410) },
      radius: randomRange(random, 62, 76)
    },
    {
      id: "cave-south",
      position: { x: randomRange(random, 310, 500), y: randomRange(random, 480, 560) },
      radius: randomRange(random, 56, 70)
    },
    {
      id: "cave-north",
      position: { x: randomRange(random, 270, 460), y: randomRange(random, 92, 180) },
      radius: randomRange(random, 52, 66)
    }
  ];
}

function createHousePosition(random: () => number): DarknessVec2 {
  return {
    x: randomRange(random, 600, 840),
    y: randomRange(random, 120, 360)
  };
}

function createCoins(random: () => number, caves: DarknessCave[], housePosition: DarknessVec2): DarknessCoin[] {
  const coins: DarknessCoin[] = [];
  for (let index = 0; index < DARKNESS_COIN_COUNT; index += 1) {
    const position = coinPosition(random, index, caves, housePosition);
    coins.push({
      id: `coin-${index}`,
      position,
      value: index % 9 === 0 ? 2 : 1
    });
  }
  return coins;
}

function coinPosition(
  random: () => number,
  index: number,
  caves: DarknessCave[],
  housePosition: DarknessVec2
): DarknessVec2 {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const position = {
      x: randomRange(random, 96, DARKNESS_WORLD_SIZE.width - 96),
      y: randomRange(random, 86, DARKNESS_WORLD_SIZE.height - 86)
    };
    if (isOpenCoinPosition(position, caves, housePosition)) {
      return position;
    }
  }

  const column = index % 7;
  const row = Math.floor(index / 7);
  return {
    x: 160 + column * 106,
    y: 92 + row * 78
  };
}

function isOpenCoinPosition(position: DarknessVec2, caves: DarknessCave[], housePosition: DarknessVec2): boolean {
  if (distance(position, housePosition) < DARKNESS_HOUSE_RADIUS + 54) {
    return false;
  }
  return caves.every((cave) => distance(position, cave.position) > cave.radius + 18);
}

function createSeededRandom(seedText: string): () => number {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

function distance(a: DarknessVec2, b: DarknessVec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
