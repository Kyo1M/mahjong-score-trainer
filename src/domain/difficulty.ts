import type { Difficulty, ScoreInput, ScoreResult } from './types'

const ADVANCED_YAKU = new Set([
  '混一色', '清一色', '三色同順', '一気通貫', '混全帯幺九', '純全帯幺九',
  '対々和', '三暗刻', '二盃口', '混老頭',
])
const STARTER_YAKU = new Set([
  '立直', '一発', '門前清自摸和', '平和', '断幺九', '一盃口',
])

function isOpen(input: ScoreInput): boolean {
  return input.melds.some((m) => m.open)
}

export function classifyDifficulty(result: ScoreResult, input: ScoreInput): Difficulty {
  if (result.isLimit) return 'limit'

  const named = result.yaku.filter((y) => !y.isDora).map((y) => y.name)
  const hasAdvanced =
    isOpen(input) ||
    named.some((n) => ADVANCED_YAKU.has(n) || n.startsWith('場風') || n.startsWith('自風')) ||
    (result.fu ?? 0) >= 50
  if (hasAdvanced) return 'advanced'

  const allStarter =
    named.length > 0 &&
    named.every((n) => STARTER_YAKU.has(n) || n.includes('白') || n.includes('發') || n.includes('中'))
  if (result.han <= 2 && allStarter && (result.fu ?? 0) <= 40) return 'starter'

  return 'standard'
}
