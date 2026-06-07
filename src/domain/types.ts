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
  evaluation: AnswerEvaluation
  elapsedMs: number
  answeredAt: string
}

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
