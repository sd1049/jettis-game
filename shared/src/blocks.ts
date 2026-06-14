import { HOUSE_SAFE_BLOCK_TYPES, SOLID_BLOCK_TYPES, WORLD_SIZE } from "./constants.js";
import type { BlockKey, BlockType, Vec3, WorldState } from "./types.js";

export function blockKey(position: Vec3): BlockKey {
  return `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`;
}

export function parseBlockKey(key: BlockKey): Vec3 {
  const [x, y, z] = key.split(",").map((part) => Number.parseInt(part, 10));
  return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
}

export function inWorldBounds(position: Vec3): boolean {
  return (
    Number.isInteger(position.x) &&
    Number.isInteger(position.y) &&
    Number.isInteger(position.z) &&
    position.x >= 0 &&
    position.x < WORLD_SIZE.width &&
    position.z >= 0 &&
    position.z < WORLD_SIZE.depth &&
    position.y >= 0 &&
    position.y < WORLD_SIZE.height
  );
}

export function getBlock(world: Pick<WorldState, "blocks">, position: Vec3): BlockType | undefined {
  return world.blocks[blockKey(position)]?.type;
}

export function isSolidBlock(blockType: BlockType | undefined): boolean {
  return blockType !== undefined && (SOLID_BLOCK_TYPES as readonly string[]).includes(blockType);
}

export function isSafeHouseBlock(blockType: BlockType | undefined): boolean {
  return blockType !== undefined && (HOUSE_SAFE_BLOCK_TYPES as readonly string[]).includes(blockType);
}

export function isAir(world: Pick<WorldState, "blocks">, position: Vec3): boolean {
  return getBlock(world, position) === undefined;
}

export function topBlockY(world: Pick<WorldState, "blocks">, x: number, z: number): number {
  for (let y = WORLD_SIZE.height - 1; y >= 0; y -= 1) {
    if (getBlock(world, { x, y, z })) {
      return y;
    }
  }
  return 0;
}

export function adjacentPositions(position: Vec3): Vec3[] {
  return [
    { x: position.x + 1, y: position.y, z: position.z },
    { x: position.x - 1, y: position.y, z: position.z },
    { x: position.x, y: position.y, z: position.z + 1 },
    { x: position.x, y: position.y, z: position.z - 1 },
    { x: position.x, y: position.y + 1, z: position.z },
    { x: position.x, y: position.y - 1, z: position.z }
  ];
}
