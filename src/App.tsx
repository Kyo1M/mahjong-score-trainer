import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { DoraView, HandView } from './components/TileView'
import { calculateStats, evaluateAnswer, formatRate } from './domain/scoring'
import { generate } from './domain/generator'
import { buildQuestion } from './domain/question-factory'
import { createRng } from './domain/rng'
import { difficultyLabel } from './domain/difficulty-label'
import type {
  AnswerChoice, AnswerEvaluation, CompletedQuestion, DifficultyFilter,
  PracticeQuestion, SessionStats, UserAnswer,
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
          <span className="brand__mark">点</span>
          <span>
            <strong>Mahjong Score Trainer</strong>
            <small>麻雀の点数計算をやさしく練習</small>
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
        <h1>牌姿を見て、役・翻・符・支払いまで一気に身につけましょう。</h1>
        <p className="lead">
          難易度を選ぶと、ランダムに作られた問題を好きなだけ練習できます。点数は検証済みの計算エンジンが採点するので、答え合わせも安心です。
        </p>
        <div className="hero-actions">
          <Link className="button button--primary" to="/practice">
            練習を始める
          </Link>
          <Link className="button button--ghost" to="/guide">
            点数計算のしくみを見る
          </Link>
        </div>
      </section>

      <section className="feature-grid" aria-label="このアプリの特徴">
        <article className="feature-card">
          <span>01</span>
          <h2>工程ごとに採点します</h2>
          <p>役・翻・符・支払いを別々に判定するので、どこで間違えたのかがひと目で分かります。</p>
        </article>
        <article className="feature-card">
          <span>02</span>
          <h2>満貫以上は実戦的に</h2>
          <p>満貫以上では符の入力を省いて、点数の区分と支払いだけに集中できます。</p>
        </article>
        <article className="feature-card">
          <span>03</span>
          <h2>今回の記録だけ残します</h2>
          <p>ログインや長期保存はありません。終了すると、今回の練習結果だけを振り返れます。</p>
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
        <h2>符の数え方のポイント</h2>
        <div className="reference-grid">
          <InfoCard title="基本">
            まず副底が20符、門前ロンはさらに10符です。ツモは原則2符ですが、平和ツモだけは20符に固定します。
          </InfoCard>
          <InfoCard title="待ち">
            単騎・嵌張・辺張の待ちは2符です。両面待ちは0符になります。
          </InfoCard>
          <InfoCard title="雀頭">
            役牌・場風・自風の雀頭は2符です。連風牌（場風かつ自風）の雀頭も2符として数えます。
          </InfoCard>
          <InfoCard title="七対子" id="chiitoi">
            七対子は25符に固定します。副底や待ちの符は積みません。
          </InfoCard>
        </div>
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
  children: string
}

function InfoCard({ title, id, children }: InfoCardProps) {
  return (
    <section className="info-card" id={id}>
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
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
