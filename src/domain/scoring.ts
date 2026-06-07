import type {
  AnswerEvaluation,
  CompletedQuestion,
  PracticeQuestion,
  SessionStats,
  UserAnswer,
} from './types'

export function evaluateAnswer(
  question: PracticeQuestion,
  selected: UserAnswer,
): AnswerEvaluation {
  const accepted = question.acceptedInterpretations
  const yakuCorrect = accepted.some((answer) =>
    sameStringSet(answer.yakuKeys, selected.yakuKeys),
  )
  const hanCorrect = accepted.some((answer) => answer.hanKey === selected.hanKey)
  const fuCorrect = question.fuRequired
    ? accepted.some((answer) => answer.fuKey === selected.fuKey)
    : true
  const paymentCorrect = accepted.some(
    (answer) => answer.paymentKey === selected.paymentKey,
  )
  const completeCorrect = accepted.some((answer) => {
    const fuMatches = question.fuRequired || selected.fuKey === 'not-needed'
      ? answer.fuKey === selected.fuKey || answer.fuKey === 'not-needed'
      : true

    return (
      sameStringSet(answer.yakuKeys, selected.yakuKeys) &&
      answer.hanKey === selected.hanKey &&
      fuMatches &&
      answer.paymentKey === selected.paymentKey
    )
  })

  return {
    completeCorrect,
    yakuCorrect,
    hanCorrect,
    fuCorrect,
    paymentCorrect,
    selected,
    accepted,
  }
}

export function calculateStats(
  completed: CompletedQuestion[],
  questions: PracticeQuestion[],
): SessionStats {
  if (completed.length === 0) {
    return {
      total: 0,
      completeCorrect: 0,
      completeRate: 0,
      yakuRate: 0,
      hanRate: 0,
      fuRate: null,
      paymentRate: 0,
      bestStreak: 0,
      currentStreak: 0,
      averageSeconds: 0,
    }
  }

  const byId = new Map(questions.map((question) => [question.id, question]))
  const completeCorrect = completed.filter(
    (entry) => entry.evaluation.completeCorrect,
  ).length
  const hanCorrect = completed.filter((entry) => entry.evaluation.hanCorrect).length
  const yakuCorrect = completed.filter((entry) => entry.evaluation.yakuCorrect).length
  const paymentCorrect = completed.filter(
    (entry) => entry.evaluation.paymentCorrect,
  ).length
  const fuEntries = completed.filter((entry) => byId.get(entry.questionId)?.fuRequired)
  const fuCorrect = fuEntries.filter((entry) => entry.evaluation.fuCorrect).length
  const streaks = completed.reduce(
    (state, entry) => {
      const current = entry.evaluation.completeCorrect ? state.current + 1 : 0
      return {
        current,
        best: Math.max(state.best, current),
      }
    },
    { current: 0, best: 0 },
  )
  const averageMs =
    completed.reduce((sum, entry) => sum + entry.elapsedMs, 0) / completed.length

  return {
    total: completed.length,
    completeCorrect,
    completeRate: ratio(completeCorrect, completed.length),
    yakuRate: ratio(yakuCorrect, completed.length),
    hanRate: ratio(hanCorrect, completed.length),
    fuRate: fuEntries.length > 0 ? ratio(fuCorrect, fuEntries.length) : null,
    paymentRate: ratio(paymentCorrect, completed.length),
    bestStreak: streaks.best,
    currentStreak: streaks.current,
    averageSeconds: Math.round((averageMs / 1000) * 10) / 10,
  }
}

export function formatRate(rate: number | null): string {
  if (rate === null) {
    return '-'
  }

  return `${Math.round(rate * 100)}%`
}

function ratio(value: number, total: number): number {
  return total === 0 ? 0 : value / total
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
}
