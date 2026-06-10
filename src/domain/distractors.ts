import type { AnswerChoice, ScoreResult } from './types'
import type { Rng } from './rng'

export function paymentChoice(result: ScoreResult): AnswerChoice {
  const label = formatPayment(result)
  return { key: paymentKey(result), label }
}

function paymentKey(result: ScoreResult): string {
  return `pay-${result.method}-${result.dealer ? 'oya' : 'ko'}-${result.defen}`
}

export function formatPayment(result: ScoreResult): string {
  if (result.method === 'ron') return `${result.defen}点`
  const pays = result.fenpei.filter((v) => v < 0).map((v) => Math.abs(v))
  if (result.dealer) {
    return `${pays[0]}点オール`
  }
  const ko = Math.min(...pays)
  const oya = Math.max(...pays)
  return `${ko} / ${oya}点`
}

export function hanChoices(result: ScoreResult, rng: Rng): AnswerChoice[] {
  const correct = result.han
  const candidates = new Set<number>([correct])
  for (const d of [-1, 1, 2, -2, 3]) {
    const v = correct + d
    if (v >= 1 && v <= 13) candidates.add(v)
    if (candidates.size >= 4) break
  }
  const choices = [...candidates].slice(0, 4).map((v) => ({ key: String(v), label: `${v}翻` }))
  return shuffle(choices, rng)
}

export function paymentDistractors(result: ScoreResult, rng: Rng): AnswerChoice[] {
  const correct = paymentChoice(result)
  const out: AnswerChoice[] = [correct]
  const factors = [0.5, 1.5, 2, 0.75]
  for (const f of factors) {
    const alt: ScoreResult = {
      ...result,
      defen: roundTo100(result.defen * f),
      fenpei: result.fenpei.map((v) => roundTo100(v * f)),
    }
    const c = paymentChoice(alt)
    if (!out.some((o) => o.key === c.key)) out.push(c)
    if (out.length >= 4) break
  }
  let bump = 1
  while (out.length < 4) {
    const altDefen = result.defen + 100 * bump
    const c = { key: `pay-extra-${bump}`, label: `${altDefen}点` }
    if (!out.some((o) => o.key === c.key)) out.push(c)
    bump++
  }
  return shuffle(out, rng)
}

function roundTo100(n: number): number {
  return Math.round(n / 100) * 100
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
