export type Suit = 'm' | 'p' | 's' | 'z'

export type Wind = '東' | '南' | '西' | '北'

export type WinMethod = 'ron' | 'tsumo'

export type Difficulty = 'starter' | 'standard' | 'advanced' | 'limit'

export type TileCode =
  | `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}${'m' | 'p' | 's'}`
  | '1z'
  | '2z'
  | '3z'
  | '4z'
  | '5z'
  | '6z'
  | '7z'
  | '0z'
  | '0m'
  | '0p'
  | '0s'
  | 'back'

export type MeldKind = 'chi' | 'pon' | 'kan'

export type Payment = {
  method: WinMethod
  label: string
  key: string
}

export type AnswerChoice = {
  key: string
  label: string
  helper?: string
}

export type AnswerOptions = {
  yaku: AnswerChoice[]
  han: AnswerChoice[]
  fu: AnswerChoice[]
  payment: AnswerChoice[]
}

export type Meld = {
  kind: MeldKind
  tiles: TileCode[]
  open: boolean
  label: string
}

export type WinContext = {
  seatWind: Wind
  roundWind: Wind
  dealer: boolean
  method: WinMethod
  riichi?: '立直' | 'ダブル立直'
  conditions: string[]
  doraIndicators: TileCode[]
  ruleNotes: string[]
}

export type BreakdownItem = {
  label: string
  value: number | string
  note?: string
}

export type AcceptedInterpretation = {
  yakuKeys: string[]
  hanKey: string
  hanLabel: string
  fuKey: string
  fuLabel: string
  paymentKey: string
  paymentLabel: string
}

export type PracticeQuestion = {
  id: string
  title: string
  difficulty: Difficulty
  prompt: string
  context: WinContext
  hand: TileCode[]
  winningTile: TileCode
  melds: Meld[]
  options: AnswerOptions
  acceptedInterpretations: AcceptedInterpretation[]
  canonicalInterpretation: AcceptedInterpretation
  fuRequired: boolean
  yaku: BreakdownItem[]
  fu: BreakdownItem[]
  explanation: string
  guideAnchors: string[]
}

export type UserAnswer = {
  yakuKeys: string[]
  hanKey: string | null
  fuKey: string | null
  paymentKey: string | null
}

export type AnswerEvaluation = {
  completeCorrect: boolean
  yakuCorrect: boolean
  hanCorrect: boolean
  fuCorrect: boolean
  paymentCorrect: boolean
  selected: UserAnswer
  accepted: AcceptedInterpretation[]
}

export type CompletedQuestion = {
  questionId: string
  fuRequired: boolean
  evaluation: AnswerEvaluation
  elapsedMs: number
  answeredAt: string
}

export type ScoreInput = {
  hand: TileCode[]          // 門前テンパイ牌（和了牌・副露牌を含まない）
  winningTile: TileCode
  melds: Meld[]
  context: WinContext
}

export type ScoreYaku = {
  name: string              // majiang の日本語役名
  han: number
  isDora: boolean           // ドラ/赤ドラ/裏ドラ（役選択肢から除外）
}

export type ScoreResult = {
  valid: boolean            // 和了かつ1役以上かつ役満でない
  yaku: ScoreYaku[]
  han: number
  fu: number | null         // 満貫以上で点数計算に不要な場合 null
  fuDetail: BreakdownItem[] | null  // 符の内訳（副底・各面子・待ち・合計・切り上げ）
  defen: number
  fenpei: number[]
  isLimit: boolean          // 満貫以上（fuRequired=false の根拠）
  dealer: boolean
  method: WinMethod
}

export type DifficultyFilter = Difficulty | 'mix'

export type GeneratedHand = ScoreInput & { seed: number }

export type SessionStats = {
  total: number
  completeCorrect: number
  completeRate: number
  yakuRate: number
  hanRate: number
  fuRate: number | null
  paymentRate: number
  bestStreak: number
  currentStreak: number
  averageSeconds: number
}
