export const WORLD_SIZE = {
  width: 64,
  depth: 64,
  height: 32
} as const;

export const DAY_DURATION_MS = 10 * 60 * 1000;
export const NIGHT_DURATION_MS = 4 * 60 * 1000;
export const MAX_PLAYERS_PER_WORLD = 2;
export const STARTING_JETPACK_CHARGE = 100;
export const WATER_TOOL_COOLDOWN_MS = 350;

export const BLOCK_TYPES = [
  "grass",
  "dirt",
  "stone",
  "wood",
  "leaves",
  "glass",
  "door",
  "ladder",
  "water",
  "lava",
  "light"
] as const;

export const SOLID_BLOCK_TYPES = [
  "grass",
  "dirt",
  "stone",
  "wood",
  "leaves",
  "glass",
  "door",
  "ladder",
  "light"
] as const;

export const HOUSE_SAFE_BLOCK_TYPES = [
  "stone",
  "wood",
  "glass",
  "door",
  "light"
] as const;

export const ITEM_IDS = [
  ...BLOCK_TYPES,
  "berries",
  "fish",
  "seed",
  "booster",
  "water_cell",
  "victory_flag",
  "helmet_blue",
  "helmet_green",
  "pack_turbo"
] as const;

export const GEAR_STYLES = {
  helmets: ["cap", "bubble", "visor", "none"],
  blasters: ["sprayer", "streamer", "bubble_cannon"],
  packs: ["starter", "twin_tank", "wing_pack"]
} as const;
