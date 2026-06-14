import type { BLOCK_TYPES, GEAR_STYLES, ITEM_IDS } from "./constants.js";

export type BlockType = (typeof BLOCK_TYPES)[number];
export type ItemId = (typeof ITEM_IDS)[number];
export type SpeedMode = "easy" | "medium" | "turbo";
export type GearHelmet = (typeof GEAR_STYLES.helmets)[number];
export type GearBlaster = (typeof GEAR_STYLES.blasters)[number];
export type GearPack = (typeof GEAR_STYLES.packs)[number];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  z: number;
}

export type BlockKey = `${number},${number},${number}`;

export interface WorldSize {
  width: number;
  depth: number;
  height: number;
}

export interface BlockCell {
  type: BlockType;
  placedBy?: string;
}

export type Inventory = Partial<Record<ItemId, number>>;

export interface GearLoadout {
  helmet: GearHelmet;
  blaster: GearBlaster;
  pack: GearPack;
  packColor: string;
  waterRange: number;
  jetpackChargeMax: number;
  speedMode: SpeedMode;
}

export interface PlayerAppearance {
  bodyColor: string;
  shirtColor: string;
  pantsColor: string;
  accentColor: string;
}

export interface PlayerState {
  id: string;
  name: string;
  appearance: PlayerAppearance;
  gear: GearLoadout;
  inventory: Inventory;
  position: Vec3;
  rotationY: number;
  health: number;
  hunger: number;
  jetpackCharge: number;
  isFlying: boolean;
  isSafe: boolean;
  lastSeenAt: number;
}

export interface CreatureState {
  id: string;
  kind: "shadow_splasher" | "storm_boss";
  position: Vec3;
  health: number;
  targetPlayerId?: string;
  nextActionAt: number;
}

export interface HazardState {
  id: string;
  kind: "quicksand" | "lava_spark" | "storm";
  position: Vec3;
  radius: number;
  expiresAt?: number;
}

export interface VillagerState {
  id: string;
  name: string;
  position: Vec3;
  line: string;
}

export interface SupplyCrateState {
  id: string;
  position: Vec3;
  inventory: Inventory;
  openedBy: string[];
}

export interface FoodNodeState {
  id: string;
  kind: "berry_bush" | "fishing_spot" | "garden_plot";
  position: Vec3;
  readyAt: number;
}

export interface DayNightState {
  phase: "day" | "night";
  phaseStartedAt: number;
  phaseEndsAt: number;
  nightCount: number;
}

export interface TradeOffer {
  playerId: string;
  items: Inventory;
  accepted: boolean;
}

export interface TradeState {
  id: string;
  worldCode: string;
  playerAId: string;
  playerBId: string;
  offers: Record<string, TradeOffer>;
  status: "pending" | "completed" | "cancelled";
  updatedAt: number;
}

export interface MissionEvent {
  id: string;
  kind:
    | "crate_opened"
    | "food_collected"
    | "water_spray"
    | "booster_found"
    | "tower_flag_ready"
    | "victory";
  message: string;
  createdAt: number;
}

export interface VictoryState {
  flagPlaced: boolean;
  bossDefeated: boolean;
  wonAt?: number;
}

export interface WorldState {
  code: string;
  version: number;
  size: WorldSize;
  blocks: Record<BlockKey, BlockCell>;
  players: Record<string, PlayerState>;
  creatures: CreatureState[];
  hazards: HazardState[];
  villagers: VillagerState[];
  crates: SupplyCrateState[];
  foodNodes: FoodNodeState[];
  trades: Record<string, TradeState>;
  dayNight: DayNightState;
  events: MissionEvent[];
  victory: VictoryState;
  updatedAt: number;
}

export type EditBlockAction = "place" | "break";

export interface EditBlockRequest {
  action: EditBlockAction;
  position: Vec3;
  blockType?: BlockType;
}

export type ToolKind = "water" | "fish" | "gather" | "victory_flag";

export interface UseToolRequest {
  tool: ToolKind;
  target: Vec3;
}

export interface PlayerInputState {
  moveX: number;
  moveZ: number;
  lookY: number;
  jump: boolean;
  fly: boolean;
  descend: boolean;
  sprint: boolean;
  tapTarget?: Vec3;
}

export interface JoinWorldPayload {
  worldCode: string;
  playerName: string;
  appearance?: Partial<PlayerAppearance>;
}

export interface WorldSummary {
  code: string;
  playerCount: number;
  nightCount: number;
  phase: DayNightState["phase"];
  updatedAt: number;
}

export interface ApplyResult<T = WorldState> {
  ok: boolean;
  value?: T;
  error?: string;
}
