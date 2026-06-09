import type {
  AcceptedInterpretation,
  AnswerChoice,
  BreakdownItem,
  PracticeQuestion,
  ScoreInput,
  ScoreResult,
} from './types'
import { mapYakuName, yakuCatalog } from './yaku-map'
import { hanChoices, paymentChoice, paymentDistractors } from './distractors'
import { classifyDifficulty } from './difficulty'
import { tileLabel } from './tiles'
import type { Rng } from './rng'

const FU_CHOICES: AnswerChoice[] = [
  { key: '20', label: '20符' },
  { key: '25', label: '25符' },
  { key: '30', label: '30符' },
  { key: '40', label: '40符' },
  { key: '50', label: '50符' },
  { key: '60', label: '60符' },
  { key: '70', label: '70符' },
  { key: 'not-needed', label: '符は不要', helper: '満貫以上または役満' },
]

// The fu answer menu is a fixed list, but generated hands can land on fu values
// OUTSIDE this set (e.g. 80+ fu toitoi/sanankou shapes still below mangan). If the
// correct fu is not selectable the question is unanswerable, so when fuRequired we
// guarantee the canonical fu key is present by inserting it before `not-needed`.
function fuOptions(result: ScoreResult, fuRequired: boolean): AnswerChoice[] {
  if (!fuRequired) return FU_CHOICES
  const key = String(result.fu)
  if (FU_CHOICES.some((c) => c.key === key)) return FU_CHOICES
  const numeric = FU_CHOICES.filter((c) => c.key !== 'not-needed')
  const notNeeded = FU_CHOICES.filter((c) => c.key === 'not-needed')
  return [...numeric, { key, label: `${result.fu}符` }, ...notNeeded]
}

const CONFUSABLE: Record<string, string[]> = {
  pinfu: ['tanyao', 'iipeiko', 'sanshoku'],
  tanyao: ['pinfu', 'sanshoku', 'iipeiko'],
  honitsu: ['chinitsu', 'chanta', 'junchan'],
  chinitsu: ['honitsu', 'ittsu'],
  toitoi: ['sananko', 'honroutou'],
  sananko: ['toitoi'],
  chiitoitsu: ['toitoi', 'iipeiko', 'ryanpeiko'],
  iipeiko: ['ryanpeiko', 'pinfu', 'sanshoku'],
}

function correctYakuKeys(result: ScoreResult): string[] {
  const keys: string[] = []
  for (const y of result.yaku) {
    if (y.isDora) continue
    const mapped = mapYakuName(y.name)
    if (mapped && !keys.includes(mapped.key)) keys.push(mapped.key)
  }
  return keys
}

function yakuOptions(correct: string[], rng: Rng): AnswerChoice[] {
  const set = new Set(correct)
  for (const k of correct) for (const c of CONFUSABLE[k] ?? []) set.add(c)
  const filler = ['riichi', 'menzen-tsumo', 'pinfu', 'tanyao', 'sanshoku', 'honitsu', 'toitoi']
  for (const k of filler) {
    if (set.size >= 7) break
    set.add(k)
  }
  const choices = [...set].map((k) => yakuCatalog[k]).filter(Boolean)
  for (let i = choices.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return choices
}

function doraNote(input: ScoreInput): string {
  const ind = input.context.doraIndicators[0]
  return ind ? `ドラ表示牌は${tileLabel(ind)}です。` : ''
}

export function buildQuestion(
  input: ScoreInput,
  result: ScoreResult,
  rng: Rng,
): PracticeQuestion {
  const difficulty = classifyDifficulty(result, input)
  const fuRequired = !result.isLimit
  const yakuKeys = correctYakuKeys(result)
  const payment = paymentChoice(result)
  const hanKey = String(result.han)
  const fuKey = fuRequired ? String(result.fu) : 'not-needed'

  const canonical: AcceptedInterpretation = {
    yakuKeys,
    hanKey,
    hanLabel: `${result.han}翻`,
    fuKey,
    fuLabel: fuRequired ? `${result.fu}符` : '点数計算上は不要',
    paymentKey: payment.key,
    paymentLabel: payment.label,
  }

  const yakuBreakdown: BreakdownItem[] = result.yaku.map((y) => ({
    label: y.isDora ? y.name : (mapYakuName(y.name)?.label ?? y.name),
    value: `${y.han}翻`,
  }))
  const fuBreakdown: BreakdownItem[] = fuRequired
    ? [{ label: '合計符', value: `${result.fu}符` }]
    : [{ label: '満貫以上', value: '符計算は不要' }]

  const seed = rng.seed
  const yakuText = yakuKeys.map((k) => yakuCatalog[k].label).join('・') || '役'
  return {
    id: `gen-${difficulty}-${seed}-${result.han}-${result.fu ?? 'L'}-${result.defen}`,
    title: yakuKeys.length ? `${yakuCatalog[yakuKeys[0]].label}を含む手` : '点数を計算',
    difficulty,
    prompt: `${input.context.dealer ? '親' : '子'}の${input.context.method === 'ron' ? 'ロン' : 'ツモ'}和了です。成立役・翻・符・支払いを選んでください。`,
    context: input.context,
    hand: input.hand,
    winningTile: input.winningTile,
    melds: input.melds,
    options: {
      yaku: yakuOptions(yakuKeys, rng),
      han: hanChoices(result, rng),
      fu: fuOptions(result, fuRequired),
      payment: paymentDistractors(result, rng),
    },
    acceptedInterpretations: [canonical],
    canonicalInterpretation: canonical,
    fuRequired,
    yaku: yakuBreakdown,
    fu: fuBreakdown,
    explanation:
      `成立した役は${yakuText}です。${doraNote(input)}` +
      (fuRequired
        ? `${result.han}翻${result.fu}符で、${payment.label}になります。`
        : `${result.han}翻以上の満貫クラスで、${payment.label}になります。`),
    guideAnchors: fuRequired ? ['fu', 'table'] : ['limit', 'payment'],
  }
}
