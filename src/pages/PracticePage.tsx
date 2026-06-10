import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { DoraView, HandView } from '../components/TileView'
import { AnswerGroup, MultiAnswerGroup } from '../components/AnswerGroup'
import { FeedbackPanel } from '../components/FeedbackPanel'
import { evaluateAnswer } from '../domain/scoring'
import { difficultyLabel } from '../domain/difficulty-label'
import type {
  AnswerEvaluation, DifficultyFilter, PracticeQuestion, UserAnswer,
} from '../domain/types'

const emptyAnswer: UserAnswer = { yakuKeys: [], hanKey: null, fuKey: null, paymentKey: null }

type PracticePageProps = {
  question: PracticeQuestion
  completedCount: number
  difficulty: DifficultyFilter
  onSetDifficulty: (d: DifficultyFilter) => void
  onAnswered: (evaluation: AnswerEvaluation, elapsedMs: number) => void
  onNext: () => void
}

export function PracticePage({
  question,
  completedCount,
  difficulty,
  onSetDifficulty,
  onAnswered,
  onNext,
}: PracticePageProps) {
  const navigate = useNavigate()
  const [answer, setAnswer] = useState<UserAnswer>(emptyAnswer)
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null)
  const [startedAt] = useState(() => performance.now())
  const [questionNumber] = useState(() => completedCount + 1)

  // 問題ごとに再マウントされるので、新しい問題は画面の一番上から始める。
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const canSubmit =
    answer.yakuKeys.length > 0 &&
    answer.hanKey !== null &&
    answer.paymentKey !== null &&
    (question.fuRequired ? answer.fuKey !== null : true)

  function submitAnswer() {
    if (!canSubmit || evaluation) {
      return
    }

    const selectedAnswer = question.fuRequired
      ? answer
      : { ...answer, fuKey: 'not-needed' }
    const result = evaluateAnswer(question, selectedAnswer)
    setEvaluation(result)
    onAnswered(result, performance.now() - startedAt)
  }

  function revealAnswer() {
    if (evaluation) {
      return
    }

    const result = evaluateAnswer(question, {
      hanKey: null,
      yakuKeys: [],
      fuKey: question.fuRequired ? null : 'not-needed',
      paymentKey: null,
    })
    setEvaluation(result)
    onAnswered(result, performance.now() - startedAt)
  }

  return (
    <main className="practice-page">
      <section className="practice-card">
        <DifficultyFilterBar value={difficulty} onChange={onSetDifficulty} />
        <div className="practice-card__topline">
          <div>
            <p className="eyebrow">Question {questionNumber}</p>
            <h1>{question.title}</h1>
          </div>
          <span className={`difficulty difficulty--${question.difficulty}`}>
            {difficultyLabel(question.difficulty)}
          </span>
        </div>

        <p className="prompt">{question.prompt}</p>
        <ContextPanel question={question} />
        <HandView
          tiles={question.hand}
          winningTile={question.winningTile}
          melds={question.melds}
          riichi={question.context.riichi}
        />

        <div className="yaku-answer-block">
          <MultiAnswerGroup
            title="成立した役（複数選べます）"
            choices={question.options.yaku}
            selectedKeys={answer.yakuKeys}
            onToggle={(yakuKey) =>
              setAnswer((current) => ({
                ...current,
                yakuKeys: toggleKey(current.yakuKeys, yakuKey),
              }))
            }
            disabled={evaluation !== null}
          />
        </div>

        <div className="answer-grid">
          <AnswerGroup
            title="翻 / 役満"
            choices={question.options.han}
            selectedKey={answer.hanKey}
            onSelect={(hanKey) => setAnswer((current) => ({ ...current, hanKey }))}
            disabled={evaluation !== null}
          />
          <AnswerGroup
            title="符"
            choices={
              question.fuRequired
                ? question.options.fu.filter((choice) => choice.key !== 'not-needed')
                : [{ key: 'not-needed', label: '符の計算は不要です' }]
            }
            selectedKey={question.fuRequired ? answer.fuKey : 'not-needed'}
            onSelect={(fuKey) => setAnswer((current) => ({ ...current, fuKey }))}
            disabled={evaluation !== null || !question.fuRequired}
          />
          <AnswerGroup
            title={question.context.method === 'ron' ? 'ロン支払い' : 'ツモ支払い'}
            choices={question.options.payment}
            selectedKey={answer.paymentKey}
            onSelect={(paymentKey) =>
              setAnswer((current) => ({ ...current, paymentKey }))
            }
            disabled={evaluation !== null}
          />
        </div>

        <div className="practice-actions">
          {evaluation === null ? (
            <>
              <button
                className="button button--primary"
                type="button"
                onClick={submitAnswer}
                disabled={!canSubmit}
              >
                採点する
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={revealAnswer}
              >
                答えを見る
              </button>
            </>
          ) : (
            <button
              className="button button--primary"
              type="button"
              onClick={onNext}
              autoFocus
            >
              次の問題へ
            </button>
          )}
          <button
            className="button button--ghost"
            type="button"
            onClick={() => navigate('/results')}
          >
            終了して結果へ
          </button>
        </div>

        {evaluation && (
          <FeedbackPanel question={question} evaluation={evaluation} onNext={onNext} />
        )}
      </section>
    </main>
  )
}

const DIFFICULTY_FILTERS: DifficultyFilter[] = ['mix', 'starter', 'standard', 'advanced', 'limit']

function DifficultyFilterBar({
  value, onChange,
}: { value: DifficultyFilter; onChange: (d: DifficultyFilter) => void }) {
  return (
    <div className="difficulty-bar" role="group" aria-label="難易度フィルタ">
      {DIFFICULTY_FILTERS.map((d) => (
        <button
          key={d}
          type="button"
          className={`difficulty-chip ${value === d ? 'is-active' : ''}`}
          aria-pressed={value === d}
          onClick={() => onChange(d)}
        >
          {difficultyLabel(d)}
        </button>
      ))}
    </div>
  )
}

type ContextPanelProps = {
  question: PracticeQuestion
}

function ContextPanel({ question }: ContextPanelProps) {
  const context = question.context
  return (
    <section className="context-panel" aria-label="問題条件">
      <span>{context.dealer ? '親' : '子'}</span>
      <span>{context.method === 'ron' ? 'ロン' : 'ツモ'}</span>
      <span>場風 {context.roundWind}</span>
      <span>自風 {context.seatWind}</span>
      {context.conditions.map((condition) => (
        <span key={condition}>{condition}</span>
      ))}
      <span className="context-panel__dora">
        ドラ表示
        <DoraView tiles={context.doraIndicators} />
      </span>
    </section>
  )
}

function toggleKey(keys: string[], key: string): string[] {
  return keys.includes(key)
    ? keys.filter((current) => current !== key)
    : [...keys, key]
}
