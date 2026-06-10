import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import './App.css'
import { DoraView, HandView, TileView } from './components/TileView'
import { calculateStats, evaluateAnswer, formatRate } from './domain/scoring'
import { generate } from './domain/generator'
import { buildQuestion } from './domain/question-factory'
import { createRng } from './domain/rng'
import { difficultyLabel } from './domain/difficulty-label'
import type {
  AnswerChoice, AnswerEvaluation, CompletedQuestion, DifficultyFilter,
  PracticeQuestion, SessionStats, TileCode, UserAnswer,
} from './domain/types'

const storageKey = 'mahjong-score-trainer-session-v3'

type StoredSession = {
  difficulty: DifficultyFilter
  completed: CompletedQuestion[]
}

const emptyAnswer: UserAnswer = { yakuKeys: [], hanKey: null, fuKey: null, paymentKey: null }

function loadSession(): StoredSession {
  const raw = window.sessionStorage.getItem(storageKey)
  if (!raw) return { difficulty: 'mix', completed: [] }
  try {
    const parsed = JSON.parse(raw) as StoredSession
    return {
      difficulty: parsed.difficulty ?? 'mix',
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    }
  } catch {
    return { difficulty: 'mix', completed: [] }
  }
}

function makeQuestion(difficulty: DifficultyFilter): PracticeQuestion {
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
  const rng = createRng(seed)
  const { input, result } = generate(difficulty, rng)
  return buildQuestion({ ...input }, result, rng)
}

function App() {
  const [session, setSession] = useState<StoredSession>(() => loadSession())
  const [question, setQuestion] = useState<PracticeQuestion>(() => makeQuestion(loadSession().difficulty))

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, JSON.stringify(session))
  }, [session])

  function resetSession() {
    setSession((s) => ({ difficulty: s.difficulty, completed: [] }))
  }

  function setDifficulty(difficulty: DifficultyFilter) {
    setSession((s) => ({ ...s, difficulty }))
    setQuestion(makeQuestion(difficulty))
  }

  function recordAnswer(evaluation: AnswerEvaluation, elapsedMs: number) {
    setSession((current) => ({
      ...current,
      completed: [
        ...current.completed,
        {
          questionId: question.id,
          fuRequired: question.fuRequired,
          evaluation,
          elapsedMs,
          answeredAt: new Date().toISOString(),
        },
      ],
    }))
  }

  function advanceQuestion() {
    setQuestion(makeQuestion(session.difficulty))
  }

  const stats = useMemo(() => calculateStats(session.completed), [session.completed])

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand__mark">
            <img src="/tiles/Chun.svg" alt="" />
          </span>
          <span>
            <strong>麻雀点数計算練習</strong>
            <small>役・翻・符・点数をまとめてトレーニング</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="メインナビゲーション">
          <NavLink to="/practice">練習</NavLink>
          <NavLink to="/guide">ガイド</NavLink>
          <NavLink to="/results">結果</NavLink>
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={<Home completed={session.completed.length} onReset={resetSession} />}
        />
        <Route
          path="/practice"
          element={
            <PracticePage
              key={question.id}
              question={question}
              completedCount={session.completed.length}
              difficulty={session.difficulty}
              onSetDifficulty={setDifficulty}
              onAnswered={recordAnswer}
              onNext={advanceQuestion}
            />
          }
        />
        <Route path="/guide" element={<GuidePage />} />
        <Route
          path="/results"
          element={<ResultsPage stats={stats} onReset={resetSession} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

type HomeProps = {
  completed: number
  onReset: () => void
}

function Home({ completed, onReset }: HomeProps) {
  return (
    <main className="home">
      <section className="hero-card">
        <p className="eyebrow">何問でもランダム出題</p>
        <h1>麻雀の点数計算、もう迷わない。</h1>
        <p className="lead">
          実戦と同じ形式のランダム問題で、役・翻・符・点数の数え方を繰り返し練習。役・翻・符・支払いを工程ごとに採点するので、どこでつまずいたかすぐ分かります。
        </p>
        <div className="hero-actions">
          <Link className="button button--primary" to="/practice">
            練習を始める
          </Link>
          <Link className="button button--ghost" to="/guide">
            点数計算のしくみを見る
          </Link>
        </div>
        <p className="hero-note">ログイン不要・無料。記録はこの練習の間だけ保存されます。</p>
      </section>

      <section className="feature-grid" aria-label="こんな人におすすめ">
        <article className="feature-card">
          <span>01</span>
          <h2>リアル麻雀で申告したい</h2>
          <p>卓を囲むときは自分で点数を数えて申告します。反復練習で、考えなくても口から出るレベルに。</p>
        </article>
        <article className="feature-card">
          <span>02</span>
          <h2>点数計算だけ自信がない</h2>
          <p>ネット麻雀は打てるけど、計算はアプリ任せ……。工程ごとの採点で、苦手な工程がはっきりします。</p>
        </article>
        <article className="feature-card">
          <span>03</span>
          <h2>もっと麻雀に詳しくなりたい</h2>
          <p>点数が分かると、押し引きや条件戦の理解も深まります。ガイドで仕組みから学べます。</p>
        </article>
      </section>

      {completed > 0 && (
        <section className="resume-card">
          <div>
            <h2>練習の続きがあります</h2>
            <p>これまでに{completed}問を解いています。続きから再開するか、最初からやり直せます。</p>
          </div>
          <div className="resume-card__actions">
            <Link className="button button--primary" to="/practice">
              続ける
            </Link>
            <button className="button button--ghost" type="button" onClick={onReset}>
              リセット
            </button>
          </div>
        </section>
      )}

      <section className="home-cta-bottom">
        <Link className="button button--primary button--large" to="/practice">
          練習を始める
        </Link>
      </section>
    </main>
  )
}

type PracticePageProps = {
  question: PracticeQuestion
  completedCount: number
  difficulty: DifficultyFilter
  onSetDifficulty: (d: DifficultyFilter) => void
  onAnswered: (evaluation: AnswerEvaluation, elapsedMs: number) => void
  onNext: () => void
}

function PracticePage({
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
        <RotateHint />

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

const rotateHintStorageKey = 'mahjong-score-trainer-rotate-hint'

// スマホ縦持ちのときだけ CSS で表示されるヒント。閉じたらセッション中は出さない。
function RotateHint() {
  const [dismissed, setDismissed] = useState(
    () => window.sessionStorage.getItem(rotateHintStorageKey) === '1',
  )

  if (dismissed) {
    return null
  }

  return (
    <p className="rotate-hint">
      <span>横持ちにすると牌が大きく表示されます</span>
      <button
        type="button"
        aria-label="ヒントを閉じる"
        onClick={() => {
          window.sessionStorage.setItem(rotateHintStorageKey, '1')
          setDismissed(true)
        }}
      >
        ✕
      </button>
    </p>
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

type AnswerGroupProps = {
  title: string
  choices: AnswerChoice[]
  selectedKey: string | null
  disabled: boolean
  onSelect: (key: string) => void
}

function AnswerGroup({
  title,
  choices,
  selectedKey,
  disabled,
  onSelect,
}: AnswerGroupProps) {
  return (
    <fieldset className="answer-group">
      <legend>{title}</legend>
      <div className="choice-list">
        {choices.map((choice) => (
          <button
            className={`choice ${selectedKey === choice.key ? 'choice--selected' : ''}`}
            key={choice.key}
            type="button"
            onClick={() => onSelect(choice.key)}
            disabled={disabled}
          >
            <span>{choice.label}</span>
            {choice.helper && <small>{choice.helper}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

type MultiAnswerGroupProps = {
  title: string
  choices: AnswerChoice[]
  selectedKeys: string[]
  disabled: boolean
  onToggle: (key: string) => void
}

function MultiAnswerGroup({
  title,
  choices,
  selectedKeys,
  disabled,
  onToggle,
}: MultiAnswerGroupProps) {
  const selected = new Set(selectedKeys)

  return (
    <fieldset className="answer-group answer-group--wide">
      <legend>{title}</legend>
      <p className="answer-group__hint">ドラは役ではないので、ここでは選ばないでください。</p>
      <div className="choice-list choice-list--multi">
        {choices.map((choice) => (
          <button
            aria-pressed={selected.has(choice.key)}
            className={`choice ${selected.has(choice.key) ? 'choice--selected' : ''}`}
            key={choice.key}
            type="button"
            onClick={() => onToggle(choice.key)}
            disabled={disabled}
          >
            <span>{choice.label}</span>
            {choice.helper && <small>{choice.helper}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

type FeedbackPanelProps = {
  question: PracticeQuestion
  evaluation: AnswerEvaluation
  onNext: () => void
}

function FeedbackPanel({ question, evaluation, onNext }: FeedbackPanelProps) {
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
          正しい答え: {yakuLabels(question, canonical.yakuKeys)} / {canonical.hanLabel}{' '}
          / {canonical.fuLabel} / {canonical.paymentLabel}
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
      <div className="feedback-panel__actions">
        <button className="button button--primary" type="button" onClick={onNext}>
          次の問題へ
        </button>
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

type ResultsPageProps = {
  stats: SessionStats
  onReset: () => void
}

function ResultsPage({ stats, onReset }: ResultsPageProps) {
  const navigate = useNavigate()

  function restart() {
    onReset()
    navigate('/practice')
  }

  return (
    <main className="results-page">
      <section className="results-card">
        <p className="eyebrow">Session Result</p>
        <h1>今回の練習結果</h1>
        {stats.total === 0 ? (
          <p className="lead">まだ回答がありません。練習を始めると、ここに結果が表示されます。</p>
        ) : (
          <>
            <div className="score-hero">
              <strong>
                {stats.completeCorrect}/{stats.total}
              </strong>
              <span>完全正解</span>
            </div>
            <div className="stats-grid">
              <Stat label="完全正解率" value={formatRate(stats.completeRate)} />
              <Stat label="役正答率" value={formatRate(stats.yakuRate)} />
              <Stat label="翻正答率" value={formatRate(stats.hanRate)} />
              <Stat label="符正答率" value={formatRate(stats.fuRate)} />
              <Stat label="支払い正答率" value={formatRate(stats.paymentRate)} />
              <Stat label="最大連続正解" value={`${stats.bestStreak}問`} />
              <Stat label="平均回答時間" value={`${stats.averageSeconds}秒`} />
            </div>
          </>
        )}
        <div className="hero-actions">
          <button className="button button--primary" type="button" onClick={restart}>
            新しいセッション
          </button>
          <Link className="button button--ghost" to="/practice">
            練習へ戻る
          </Link>
        </div>
      </section>
    </main>
  )
}

type StatProps = {
  label: string
  value: string
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function GuidePage() {
  return (
    <main className="guide-page">
      <section className="guide-hero">
        <p className="eyebrow">Guide</p>
        <h1>点数計算のしくみ</h1>
        <p className="lead">
          このアプリでは、場ゾロを除いた一般的な翻数で表記します。ルールは「切り上げ満貫なし・数え役満あり・連風牌の雀頭は2符」で統一しています。
        </p>
      </section>

      <article className="guide-section" id="flow">
        <h2>基本の流れ</h2>
        <ol>
          <li>まず成立した役を見抜きます。ドラは役ではなく、翻数に足す要素として扱います。</li>
          <li>成立役とドラを合わせて、翻数を数えます。</li>
          <li>満貫に届かないときは符を積み、10符単位に切り上げます。</li>
          <li>親か子か、ロンかツモかに合わせて支払い点を選びます。</li>
        </ol>
      </article>

      <article className="guide-section" id="fu">
        <h2>符の数え方</h2>
        <p>
          符は「全員がもらえる基本の20符」に、手の形に応じたボーナスを足したものです。次の1〜5を足して、最後に1の位を切り上げます。
        </p>
        <ol className="fu-steps">
          <li>
            <strong>副底（基本）= 20符</strong> — どんな和了でも必ず20符からスタートします。
          </li>
          <li>
            <strong>和了り方</strong> — 門前ロンは+10符。ツモは+2符（平和ツモを除く）。
          </li>
          <li>
            <strong>雀頭（アタマ）</strong> — 役牌の対子なら+2符。
          </li>
          <li>
            <strong>待ちの形</strong> — 単騎・嵌張・辺張は+2符。
          </li>
          <li>
            <strong>面子</strong> — 刻子・槓子は+2〜32符。順子は0符。
          </li>
        </ol>

        <div className="reference-grid reference-grid--fu">
          <InfoCard title="雀頭（アタマ）の符" id="yakuhai">
            <p>
              雀頭が役牌（白・發・中、場風、自風）なら2符。数牌や役に絡まない風牌の雀頭は0符です。連風牌（場風かつ自風）も2符と数えます。
            </p>
            <ul className="fu-examples">
              <li>
                <TileStrip tiles={['7z', '7z']} />
                <span>
                  中の雀頭 → <strong>2符</strong>
                </span>
              </li>
              <li>
                <TileStrip tiles={['1z', '1z']} />
                <span>
                  東の雀頭（東場・東家のとき）→ <strong>2符</strong>
                </span>
              </li>
              <li>
                <TileStrip tiles={['8p', '8p']} />
                <span>
                  数牌の雀頭 → <strong>0符</strong>
                </span>
              </li>
            </ul>
          </InfoCard>
          <InfoCard title="待ちの形の符">
            <p>
              2種類の牌で待てる両面と、刻子になるシャンポンは0符。1種類しか待てない単騎・嵌張・辺張は2符です。
            </p>
            <ul className="fu-examples">
              <li>
                <TileStrip tiles={['5s', '6s']} winning="7s" />
                <span>
                  両面（4索・7索待ち）→ <strong>0符</strong>
                </span>
              </li>
              <li>
                <TileStrip tiles={['4m']} winning="4m" />
                <span>
                  単騎（雀頭の片割れ待ち）→ <strong>2符</strong>
                </span>
              </li>
              <li>
                <TileStrip tiles={['4p', '6p']} winning="5p" />
                <span>
                  嵌張（間の牌待ち）→ <strong>2符</strong>
                </span>
              </li>
              <li>
                <TileStrip tiles={['1s', '2s']} winning="3s" />
                <span>
                  辺張（3索だけ待ち）→ <strong>2符</strong>
                </span>
              </li>
            </ul>
          </InfoCard>
        </div>

        <h3 className="fu-subheading">面子の符</h3>
        <p>
          順子は0符。刻子と槓子は「鳴いたかどうか」と「中張牌か么九牌か」で決まります。ロンで完成した刻子は明刻として数えます。
        </p>
        <div className="score-table-wrap">
          <table className="score-table score-table--fu">
            <thead>
              <tr>
                <th>面子</th>
                <th>中張牌（2〜8）</th>
                <th>么九牌（1・9・字牌）</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>順子</th>
                <td>0符</td>
                <td>0符</td>
              </tr>
              <tr>
                <th>明刻（ポン・ロン完成）</th>
                <td>2符</td>
                <td>4符</td>
              </tr>
              <tr>
                <th>暗刻</th>
                <td>4符</td>
                <td>8符</td>
              </tr>
              <tr>
                <th>明槓</th>
                <td>8符</td>
                <td>16符</td>
              </tr>
              <tr>
                <th>暗槓</th>
                <td>16符</td>
                <td>32符</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="fu-examples fu-examples--row">
          <li>
            <TileStrip tiles={['3m', '3m', '3m']} />
            <span>
              中張牌の暗刻 → <strong>4符</strong>
            </span>
          </li>
          <li>
            <TileStrip tiles={['5z', '5z', '5z']} />
            <span>
              白（么九牌）の暗刻 → <strong>8符</strong>
            </span>
          </li>
        </ul>

        <div className="reference-grid reference-grid--fu-exceptions">
          <InfoCard title="平和ツモは20符" id="pinfu">
            <p>平和をツモったときはツモの2符を数えず、20符に固定します。</p>
          </InfoCard>
          <InfoCard title="七対子は25符" id="chiitoi">
            <p>七対子は常に25符。副底や待ちの符は積みません。</p>
          </InfoCard>
          <InfoCard title="喰い平和形は30符">
            <p>鳴いて符が20符のままロンしたときは、最低の30符として数えます。</p>
          </InfoCard>
        </div>

        <h3 className="fu-subheading">計算してみよう</h3>
        <p>白のみ・門前ロンの手で、実際に符を数えてみます。</p>
        <HandView tiles={FU_EXAMPLE_HAND} winningTile="6s" melds={[]} />
        <BreakdownList
          title="符の内訳"
          items={[
            { label: '副底', value: '20符' },
            { label: '門前ロン', value: '+10符' },
            { label: '白の暗刻（么九牌）', value: '+8符' },
            { label: '雀頭（八筒）と両面待ちは0符', value: '+0符' },
            { label: '合計 38符 → 1の位を切り上げ', value: '40符' },
          ]}
        />
      </article>

      <article className="guide-section" id="table">
        <h2>よく出る点数（子のロン）</h2>
        <p>切り上げ満貫は採用していないので、30符4翻と60符3翻は満貫ではなく7700点です。</p>
        <div className="score-table-wrap">
          <table className="score-table">
            <thead>
              <tr>
                <th>子ロン</th>
                <th>30符</th>
                <th>40符</th>
                <th>50符</th>
                <th>60符</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>1翻</th>
                <td>1000</td>
                <td>1300</td>
                <td>1600</td>
                <td>2000</td>
              </tr>
              <tr>
                <th>2翻</th>
                <td>2000</td>
                <td>2600</td>
                <td>3200</td>
                <td>3900</td>
              </tr>
              <tr>
                <th>3翻</th>
                <td>3900</td>
                <td>5200</td>
                <td>6400</td>
                <td>7700</td>
              </tr>
              <tr>
                <th>4翻</th>
                <td>7700</td>
                <td>8000</td>
                <td>8000</td>
                <td>8000</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="guide-section" id="limit">
        <h2>満貫以上</h2>
        <p>翻数が増えると、点数は段階的に上がります（子の点数 / 親の点数）。</p>
        <ul>
          <li>満貫：5翻（4翻でも符が高いと満貫）。8000点 / 12000点。</li>
          <li>跳満（ハネマン）：6〜7翻。12000点 / 18000点。</li>
          <li>倍満（バイマン）：8〜10翻。16000点 / 24000点。</li>
          <li>三倍満（サンバイマン）：11〜12翻。24000点 / 36000点。</li>
          <li>数え役満：13翻以上。32000点 / 48000点。</li>
        </ul>
        <p id="yakuman">
          四暗刻や国士無双などの役満は、複合すると倍々で加算されます。ただし、このアプリでは個別のダブル役満（国士無双十三面待ちなど）は扱いません。
        </p>
      </article>

      <article className="guide-section" id="payment">
        <h2>支払いの読み方</h2>
        <p>
          子のツモは「子の支払い / 親の支払い」と表記します。たとえば満貫ツモは
          2000 / 4000点、親の満貫ツモは4000点オールです。
        </p>
      </article>

      <article className="guide-section" id="kuisagari">
        <h2>喰い下がり</h2>
        <p>
          三色同順・一気通貫・混一色・純全帯幺九・清一色などは、副露すると翻数が1翻下がります。問題では副露の有無を必ず表示します。
        </p>
      </article>
    </main>
  )
}

type InfoCardProps = {
  title: string
  id?: string
  children: ReactNode
}

function InfoCard({ title, id, children }: InfoCardProps) {
  return (
    <section className="info-card" id={id}>
      <h3>{title}</h3>
      <div className="info-card__body">{children}</div>
    </section>
  )
}

// ガイド用: 符計算の例に使う固定の手牌（白のみ・門前ロン・38→40符）。
const FU_EXAMPLE_HAND: TileCode[] = [
  '2m', '3m', '4m', '5m', '6m', '7m', '8p', '8p', '4s', '5s', '5z', '5z', '5z',
]

type TileStripProps = {
  tiles: TileCode[]
  winning?: TileCode
}

// ガイド内で牌の並びを小さくインライン表示する。
function TileStrip({ tiles, winning }: TileStripProps) {
  return (
    <span className="tile-strip">
      {tiles.map((tile, index) => (
        <TileView key={`${tile}-${index}`} tile={tile} compact />
      ))}
      {winning && <TileView tile={winning} winning compact />}
    </span>
  )
}

function guideLabel(anchor: string): string {
  const labels: Record<string, string> = {
    flow: '手順',
    fu: '符',
    table: '点数表',
    pinfu: '平和',
    chiitoi: '七対子',
    yakuhai: '役牌',
    limit: '満貫以上',
    payment: '支払い',
    kuisagari: '喰い下がり',
    yakuman: '役満',
  }

  return labels[anchor] ?? anchor
}

function toggleKey(keys: string[], key: string): string[] {
  return keys.includes(key)
    ? keys.filter((current) => current !== key)
    : [...keys, key]
}

function yakuLabels(question: PracticeQuestion, keys: string[]): string {
  const byKey = new Map(question.options.yaku.map((choice) => [choice.key, choice.label]))
  return keys.map((key) => byKey.get(key) ?? key).join('・')
}

export default App
