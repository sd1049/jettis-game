import { Pool } from "pg";
import {
  cloneDarknessWorld,
  cloneWorld,
  createInitialDarknessWorld,
  createInitialWorld,
  type DarknessWorldState,
  type DarknessWorldSummary,
  type WorldState,
  type WorldSummary
} from "@jettis/shared";
import { createWorldCode } from "./ids.js";

export interface Persistence {
  init(): Promise<void>;
  createWorld(): Promise<WorldState>;
  loadWorld(code: string): Promise<WorldState | undefined>;
  saveWorld(world: WorldState): Promise<void>;
  getWorldSummary(code: string): Promise<WorldSummary | undefined>;
  createDarknessWorld(): Promise<DarknessWorldState>;
  loadDarknessWorld(code: string): Promise<DarknessWorldState | undefined>;
  saveDarknessWorld(world: DarknessWorldState): Promise<void>;
  getDarknessWorldSummary(code: string): Promise<DarknessWorldSummary | undefined>;
}

export class MemoryPersistence implements Persistence {
  private worlds = new Map<string, WorldState>();
  private darknessWorlds = new Map<string, DarknessWorldState>();

  async init(): Promise<void> {
    return Promise.resolve();
  }

  async createWorld(): Promise<WorldState> {
    let code = createWorldCode();
    while (this.worlds.has(code)) {
      code = createWorldCode();
    }
    const world = createInitialWorld(code);
    this.worlds.set(code, cloneWorld(world));
    return cloneWorld(world);
  }

  async loadWorld(code: string): Promise<WorldState | undefined> {
    const world = this.worlds.get(normalizeCode(code));
    return world ? cloneWorld(world) : undefined;
  }

  async saveWorld(world: WorldState): Promise<void> {
    this.worlds.set(normalizeCode(world.code), cloneWorld(world));
  }

  async getWorldSummary(code: string): Promise<WorldSummary | undefined> {
    const world = this.worlds.get(normalizeCode(code));
    return world ? summarize(world) : undefined;
  }

  async createDarknessWorld(): Promise<DarknessWorldState> {
    let code = createWorldCode();
    while (this.darknessWorlds.has(code)) {
      code = createWorldCode();
    }
    const world = createInitialDarknessWorld(code);
    this.darknessWorlds.set(code, cloneDarknessWorld(world));
    return cloneDarknessWorld(world);
  }

  async loadDarknessWorld(code: string): Promise<DarknessWorldState | undefined> {
    const world = this.darknessWorlds.get(normalizeCode(code));
    return world ? cloneDarknessWorld(world) : undefined;
  }

  async saveDarknessWorld(world: DarknessWorldState): Promise<void> {
    this.darknessWorlds.set(normalizeCode(world.code), cloneDarknessWorld(world));
  }

  async getDarknessWorldSummary(code: string): Promise<DarknessWorldSummary | undefined> {
    const world = this.darknessWorlds.get(normalizeCode(code));
    return world ? summarizeDarkness(world) : undefined;
  }
}

export class PostgresPersistence implements Persistence {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
    });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS worlds (
        code text PRIMARY KEY,
        state jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        world_code text NOT NULL REFERENCES worlds(code) ON DELETE CASCADE,
        player_id text NOT NULL,
        player_name text NOT NULL,
        state jsonb NOT NULL,
        last_active_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (world_code, player_id)
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS darkness_worlds (
        code text PRIMARY KEY,
        state jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async createWorld(): Promise<WorldState> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const world = createInitialWorld(createWorldCode());
      try {
        await this.saveWorld(world);
        return world;
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }
    throw new Error("Could not create a unique world code.");
  }

  async loadWorld(code: string): Promise<WorldState | undefined> {
    const result = await this.pool.query<{ state: WorldState }>("SELECT state FROM worlds WHERE code = $1", [
      normalizeCode(code)
    ]);
    return result.rows[0]?.state;
  }

  async saveWorld(world: WorldState): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO worlds (code, state, version, updated_at)
      VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
      ON CONFLICT (code)
      DO UPDATE SET state = EXCLUDED.state, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at
    `,
      [normalizeCode(world.code), JSON.stringify(world), world.version, world.updatedAt]
    );

    for (const player of Object.values(world.players)) {
      await this.pool.query(
        `
        INSERT INTO players (world_code, player_id, player_name, state, last_active_at)
        VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))
        ON CONFLICT (world_code, player_id)
        DO UPDATE SET player_name = EXCLUDED.player_name, state = EXCLUDED.state, last_active_at = EXCLUDED.last_active_at
      `,
        [normalizeCode(world.code), player.id, player.name, JSON.stringify(player), player.lastSeenAt]
      );
    }
  }

  async getWorldSummary(code: string): Promise<WorldSummary | undefined> {
    const world = await this.loadWorld(code);
    return world ? summarize(world) : undefined;
  }

  async createDarknessWorld(): Promise<DarknessWorldState> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const world = createInitialDarknessWorld(createWorldCode());
      try {
        await this.saveDarknessWorld(world);
        return world;
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }
    throw new Error("Could not create a unique Darkness world code.");
  }

  async loadDarknessWorld(code: string): Promise<DarknessWorldState | undefined> {
    const result = await this.pool.query<{ state: DarknessWorldState }>(
      "SELECT state FROM darkness_worlds WHERE code = $1",
      [normalizeCode(code)]
    );
    return result.rows[0]?.state;
  }

  async saveDarknessWorld(world: DarknessWorldState): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO darkness_worlds (code, state, version, updated_at)
      VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
      ON CONFLICT (code)
      DO UPDATE SET state = EXCLUDED.state, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at
    `,
      [normalizeCode(world.code), JSON.stringify(world), world.version, world.updatedAt]
    );
  }

  async getDarknessWorldSummary(code: string): Promise<DarknessWorldSummary | undefined> {
    const world = await this.loadDarknessWorld(code);
    return world ? summarizeDarkness(world) : undefined;
  }
}

export function createPersistence(): Persistence {
  if (process.env.DATABASE_URL) {
    return new PostgresPersistence(process.env.DATABASE_URL);
  }
  return new MemoryPersistence();
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function summarize(world: WorldState): WorldSummary {
  return {
    code: world.code,
    playerCount: Object.keys(world.players).length,
    nightCount: world.dayNight.nightCount,
    phase: world.dayNight.phase,
    updatedAt: world.updatedAt
  };
}

function summarizeDarkness(world: DarknessWorldState): DarknessWorldSummary {
  return {
    code: world.code,
    playerCount: Object.keys(world.players).length,
    phase: world.dayNight.phase,
    winnerPlayerId: world.winnerPlayerId,
    updatedAt: world.updatedAt
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
