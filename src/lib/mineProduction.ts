function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashCoords(cx: number, cy: number, salt = 0): number {
  let h = 2166136261 ^ salt;
  h = Math.imul(h ^ cx, 16777619);
  h = Math.imul(h ^ cy, 16777619);
  return h >>> 0;
}

export function getMineSteelPerTickForChunk(chunkX: number, chunkY: number): number {
  const rng = seededRandom(hashCoords(chunkX, chunkY, 7103));
  const difficultyMult = 1 + Math.hypot(chunkX, chunkY) * 0.15;
  return 1 + Math.floor(rng() * 3 * difficultyMult);
}

export function getMineSteelPerTickFromMineId(mineId: string): number {
  const match = /^mine-(-?\d+)-(-?\d+)$/.exec(mineId);
  if (!match) return 0;

  return getMineSteelPerTickForChunk(Number(match[1]), Number(match[2]));
}

export function getMineSteelPerMinuteFromMineIds(mineIds: string[]): number {
  return mineIds.reduce((total, mineId) => total + getMineSteelPerTickFromMineId(mineId) * 6, 0);
}
