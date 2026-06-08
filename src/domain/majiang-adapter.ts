import type { TileCode } from './types'

const SUIT_ORDER = ['m', 'p', 's', 'z'] as const

export function toMajiang(tile: TileCode): string {
  // TileCode は `${number}${suit}`（赤は 0）、z は 1..7。majiang は `${suit}${number}`。
  const num = tile[0]
  const suit = tile[1]
  return `${suit}${num}`
}

export function fromMajiang(pai: string): TileCode {
  const suit = pai[0]
  const num = pai[1]
  return `${num}${suit}` as TileCode
}

export function buildBingpai(tiles: TileCode[]): string {
  const bySuit: Record<string, number[]> = { m: [], p: [], s: [], z: [] }
  for (const tile of tiles) {
    const suit = tile[1]
    bySuit[suit].push(Number(tile[0]))
  }
  let out = ''
  for (const suit of SUIT_ORDER) {
    const nums = bySuit[suit]
    if (nums.length === 0) continue
    nums.sort((a, b) => a - b)
    out += suit + nums.join('')
  }
  return out
}
