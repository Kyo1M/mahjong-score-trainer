import { Link } from 'react-router-dom'
import type { AnswerEvaluation, PracticeQuestion } from '../domain/types'
import { guideLabel } from '../pages/guide-labels'

type FeedbackPanelProps = {
  question: PracticeQuestion
  evaluation: AnswerEvaluation
}

export function FeedbackPanel({ question, evaluation }: FeedbackPanelProps) {
  const canonical = question.canonicalInterpretation

  return (
    <section className="feedback-panel" aria-live="polite">
      <div
        className={`feedback-summary ${
          evaluation.completeCorrect
            ? 'feedback-summary--correct'
            : 'feedback-summary--incorrect'
        }`}
      >
        <strong>{evaluation.completeCorrect ? 'すべて正解です！' : 'おしい！もう一度確認しましょう'}</strong>
        <span>
          正しい答え: {yakuLabels(question, canonical.yakuKeys)} / {canonical.fuLabel}{' '}
          / {canonical.hanLabel} / {canonical.paymentLabel}
        </span>
      </div>

      <div className="partial-grid">
        <ResultBadge label="役" correct={evaluation.yakuCorrect} />
        <ResultBadge label="翻" correct={evaluation.hanCorrect} />
        <ResultBadge label="符" correct={evaluation.fuCorrect} />
        <ResultBadge label="支払い" correct={evaluation.paymentCorrect} />
      </div>

      <div className="breakdown-grid">
        <BreakdownList title="役・翻" items={question.yaku} />
        <BreakdownList title="符内訳" items={question.fu} />
      </div>
      <p className="explanation">{question.explanation}</p>
      <div className="guide-links">
        {question.guideAnchors.map((anchor) => (
          <Link key={anchor} to={`/guide#${anchor}`}>
            くわしくはガイド: {guideLabel(anchor)}
          </Link>
        ))}
      </div>
    </section>
  )
}

type ResultBadgeProps = {
  label: string
  correct: boolean
}

function ResultBadge({ label, correct }: ResultBadgeProps) {
  return (
    <span className={`result-badge ${correct ? 'is-correct' : 'is-incorrect'}`}>
      {label}: {correct ? '正解' : '不正解'}
    </span>
  )
}

type BreakdownListProps = {
  title: string
  items: PracticeQuestion['yaku']
}

function BreakdownList({ title, items }: BreakdownListProps) {
  return (
    <section className="breakdown-list">
      <h3>{title}</h3>
      <dl>
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <dt>{item.label}</dt>
            <dd>
              {item.value}
              {item.note && <small>{item.note}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function yakuLabels(question: PracticeQuestion, keys: string[]): string {
  const byKey = new Map(question.options.yaku.map((choice) => [choice.key, choice.label]))
  return keys.map((key) => byKey.get(key) ?? key).join('・')
}
