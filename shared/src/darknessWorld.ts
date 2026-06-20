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
  const caves = createCaves();
  return {
    code,
    version: 1,
    size: DARKNESS_WORLD_SIZE,
    players: {},
    coins: createCoins(),
    caves,
    house: {
      id: "house-1",
      position: { x: 804, y: 140 },
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

function createCaves(): DarknessCave[] {
  return [
    { id: "cave-west", position: { x: 138, y: 338 }, radius: 70 },
    { id: "cave-south", position: { x: 360, y: 522 }, radius: 64 },
    { id: "cave-north", position: { x: 332, y: 122 }, radius: 58 }
  ];
}

function createCoins(): DarknessCoin[] {
  const coins: DarknessCoin[] = [];
  for (let index = 0; index < DARKNESS_COIN_COUNT; index += 1) {
    const position = coinPosition(index);
    coins.push({
      id: `coin-${index}`,
      position,
      value: index % 9 === 0 ? 2 : 1
    });
  }
  return coins;
}

function coinPosition(index: number): DarknessVec2 {
  const column = index % 7;
  const row = Math.floor(index / 7);
  const wobbleX = Math.sin(index * 1.91) * 34;
  const wobbleY = Math.cos(index * 1.37) * 26;
  return {
    x: 190 + column * 96 + wobbleX,
    y: 96 + row * 78 + wobbleY
  };
}
