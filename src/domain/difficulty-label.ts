import type { DifficultyFilter } from './types'

export function difficultyLabel(d: DifficultyFilter): string {
  const labels: Record<DifficultyFilter, string> = {
    mix: 'ミックス',
    starter: '初級',
    standard: '標準',
    advanced: '応用',
    limit: '満貫以上',
  }
  return labels[d]
}
