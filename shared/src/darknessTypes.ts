export interface DarknessVec2 {
  x: number;
  y: number;
}

export interface DarknessDayNightState {
  phase: "morning" | "night";
  phaseStartedAt: number;
  phaseEndsAt: number;
  nightCount: number;
}

export interface DarknessPlayerState {
  id: string;
  name: string;
  color: string;
  wristbandColor: string;
  position: DarknessVec2;
  coins: number;
  stunnedUntil: number;
  zapCooldownUntil: number;
  shieldActiveUntil: number;
  shieldCooldownUntil: number;
  lastSeenAt: number;
}

export interface DarknessCoin {
  id: string;
  position: DarknessVec2;
  value: number;
}

export interface DarknessCave {
  id: string;
  position: DarknessVec2;
  radius: number;
}

export interface DarknessHouse {
  id: string;
  position: DarknessVec2;
  radius: number;
  price: number;
  ownerPlayerId?: string;
}

export interface DarknessEvent {
  id: string;
  kind: "coin" | "zap" | "shield" | "house" | "phase" | "join";
  message: string;
  createdAt: number;
}

export interface DarknessWorldState {
  code: string;
  version: number;
  size: {
    width: number;
    height: number;
  };
  players: Record<string, DarknessPlayerState>;
  coins: DarknessCoin[];
  caves: DarknessCave[];
  house: DarknessHouse;
  dayNight: DarknessDayNightState;
  events: DarknessEvent[];
  winnerPlayerId?: string;
  updatedAt: number;
}

export interface DarknessInputState {
  moveX: number;
  moveY: number;
}

export interface JoinDarknessWorldPayload {
  worldCode: string;
  playerName: string;
}

export interface DarknessWorldSummary {
  code: string;
  playerCount: number;
  phase: DarknessDayNightState["phase"];
  winnerPlayerId?: string;
  updatedAt: number;
}
