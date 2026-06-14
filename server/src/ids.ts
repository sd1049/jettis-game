const WORLD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createWorldCode(length = 6): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += WORLD_ALPHABET[Math.floor(Math.random() * WORLD_ALPHABET.length)];
  }
  return code;
}

export function createPlayerId(): string {
  return `player_${cryptoRandom()}`;
}

function cryptoRandom(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
