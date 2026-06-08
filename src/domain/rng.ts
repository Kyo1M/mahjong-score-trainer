export type Rng = {
  seed: number
  next(): number          // [0,1)
  int(n: number): number  // [0,n)
  pick<T>(items: readonly T[]): T
  bool(p?: number): boolean
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = (): number => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    seed,
    next,
    int: (n) => Math.floor(next() * n),
    pick: (items) => items[Math.floor(next() * items.length)],
    bool: (p = 0.5) => next() < p,
  }
}
