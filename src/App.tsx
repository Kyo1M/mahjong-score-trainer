import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { DoraView, HandView } from './components/TileView'
import { calculateStats, evaluateAnswer, formatRate } from './domain/scoring'
import {
  nextQuestionIndex,
  practiceQuestions,
} from './domain/questions'
import type {
  AnswerChoice,
  AnswerEvaluation,
  CompletedQuestion,
  PracticeQuestion,
  SessionStats,
  UserAnswer,
} from './domain/types'

const storageKey = 'mahjong-score-trainer-session-v2'

type StoredSession = {
  questionIndex: number
  completed: CompletedQuestion[]
}

const emptyAnswer: UserAnswer = {
  yakuKeys: [],
  hanKey: null,
  fuKey: null,
  paymentKey: null,
}

function loadSession(): StoredSession {
  const raw = window.sessionStorage.getItem(storageKey)
  if (!raw) {
    return { questionIndex: 0, completed: [] }
  }

  try {
    const parsed = JSON.parse(raw) as StoredSession
    return {
      questionIndex: parsed.questionIndex ?? 0,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    }
  } catch {
    return { questionIndex: 0, completed: [] }
  }
}

function App() {
  const [session, setSession] = useState<StoredSession>(() => loadSession())

  useEffect(() => {
    window.sessionStorage.setItem(storageKey, JSON.stringify(session))
  }, [session])

  function resetSession() {
    setSession({ questionIndex: 0, completed: [] })
  }

  function recordAnswer(evaluation: AnswerEvaluation, elapsedMs: number) {
    setSession((current) => ({
      questionIndex: current.questionIndex,
      completed: [
        ...current.completed,
        {
          questionId: practiceQuestions[current.questionIndex].id,
          evaluation,
          elapsedMs,
          answeredAt: new Date().toISOString(),
        },
      ],
    }))
  }

  function advanceQuestion() {
    setSession((current) => ({
      ...current,
      questionIndex: nextQuestionIndex(
        current.questionIndex,
        current.completed.length,
      ),
    }))
  }

  const stats = useMemo(
    () => calculateStats(session.completed, practiceQuestions),
    [session.completed],
  )

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand__mark">点</span>
          <span>
            <strong>Mahjong Score Trainer</strong>
            <small>Mリーグ準拠の点数計算練習</small>
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
              key={practiceQuestions[session.questionIndex].id}
              question={practiceQuestions[session.questionIndex]}
              completedCount={session.completed.length}
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
        <p className="eyebrow">MVP: vetted practice set</p>
        <h1>牌姿を見て、役・翻・符・支払いまで一気に鍛える。</h1>
        <p className="lead">
          いまは固定問題で正しさを優先した総合練習版です。全役ランダム生成は、採点エンジンの検証が十分に揃ってから拡張します。
        </p>
        <div className="hero-actions">
          <Link className="button button--primary" to="/practice">
            練習を始める
          </Link>
          <Link className="button button--ghost" to="/guide">
            点数計算を確認
          </Link>
        </div>
      </section>

      <section className="feature-grid" aria-label="MVPの特徴">
        <article className="feature-card">
          <span>01</span>
          <h2>工程別に採点</h2>
          <p>成立役、翻、符、支払い点を別々に判定し、どこでズレたかをすぐ確認できます。</p>
        </article>
        <article className="feature-card">
          <span>02</span>
          <h2>満貫以上は実戦寄り</h2>
          <p>満貫以上では符を回答必須にせず、区分と支払いに集中します。</p>
        </article>
        <article className="feature-card">
          <span>03</span>
          <h2>セッションだけ記録</h2>
          <p>ログインも長期保存もなし。任意終了で今回の結果だけを確認します。</p>
        </article>
      </section>

      {completed > 0 && (
        <section className="resume-card">
          <div>
            <h2>進行中のセッションがあります</h2>
            <p>{completed}問回答済みです。続けるか、最初からやり直せます。</p>
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
    </main>
  )
}

type PracticePageProps = {
  question: PracticeQuestion
  completedCount: number
  onAnswered: (evaluation: AnswerEvaluation, elapsedMs: number) => void
  onNext: () => void
}

function PracticePage({
  question,
  completedCount,
  onAnswered,
  onNext,
}: PracticePageProps) {
  const navigate = useNavigate()
  const [answer, setAnswer] = useState<UserAnswer>(emptyAnswer)
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null)
  const [startedAt] = useState(() => performance.now())
  const [questionNumber] = useState(() => completedCount + 1)

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
        />

        <div className="yaku-answer-block">
          <MultiAnswerGroup
            title="成立役（複数選択）"
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
                : [{ key: 'not-needed', label: '点数計算上は不要' }]
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
          <button
            className="button button--primary"
            type="button"
            onClick={submitAnswer}
            disabled={!canSubmit || evaluation !== null}
          >
            採点する
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={revealAnswer}
            disabled={evaluation !== null}
          >
            答えを見る
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => navigate('/results')}
          >
            終了して結果へ
          </button>
        </div>

        {evaluation && (
          <FeedbackPanel
            question={question}
            evaluation={evaluation}
            onNext={onNext}
          />
        )}
      </section>
    </main>
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
      {context.riichi && <span>{context.riichi}</span>}
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
      <p className="answer-group__hint">ドラは役ではないため、ここでは選びません。</p>
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
        <strong>{evaluation.completeCorrect ? '完全正解' : '要確認'}</strong>
        <span>
          正解: {yakuLabels(question, canonical.yakuKeys)} / {canonical.hanLabel}{' '}
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
            ガイド: {guideLabel(anchor)}
          </Link>
        ))}
      </div>
      <button className="button button--primary" type="button" onClick={onNext}>
        次の問題へ
      </button>
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
          <p className="lead">まだ回答がありません。練習を始めると結果が表示されます。</p>
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
        <h1>点数計算の確認ページ</h1>
        <p className="lead">
          MVPでは場ゾロを除いた一般的な翻数表記で統一します。Mリーグ準拠として、切り上げ満貫あり、数え役満なし、連風牌の雀頭は2符です。
        </p>
      </section>

      <article className="guide-section" id="flow">
        <h2>基本の流れ</h2>
        <ol>
          <li>成立役を見抜く。ドラは役ではなく、翻数に足す要素として扱う。</li>
          <li>成立役とドラを合わせて翻数を出す。</li>
          <li>満貫未満なら符を積み、10符単位へ切り上げる。</li>
          <li>親子とロン/ツモで支払い点を選ぶ。</li>
        </ol>
      </article>

      <article className="guide-section" id="fu">
        <h2>符計算の要点</h2>
        <div className="reference-grid">
          <InfoCard title="基本">
            副底20符。門前ロンは10符。ツモは原則2符だが、平和ツモは20符固定。
          </InfoCard>
          <InfoCard title="待ち">
            単騎、嵌張、辺張は2符。両面待ちは0符。
          </InfoCard>
          <InfoCard title="雀頭">
            役牌、場風、自風は2符。Mリーグでは連風牌の雀頭も2符。
          </InfoCard>
          <InfoCard title="七対子" id="chiitoi">
            七対子は25符固定。通常の副底や待ち符は積まない。
          </InfoCard>
        </div>
      </article>

      <article className="guide-section" id="table">
        <h2>頻出点数</h2>
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
                <td>8000</td>
              </tr>
              <tr>
                <th>4翻</th>
                <td>8000</td>
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
        <ul>
          <li>5翻、30符4翻、60符3翻は満貫。</li>
          <li>6〜7翻は跳満、8〜10翻は倍満、11翻以上は三倍満。</li>
          <li>数え役満は採用せず、役満以外は三倍満が上限。</li>
          <li id="yakuman">役満の複合はあり。個別のダブル役満は扱わない。</li>
        </ul>
      </article>

      <article className="guide-section" id="payment">
        <h2>支払いの読み方</h2>
        <p>
          子のツモ表記は「子の支払い / 親の支払い」です。例: 満貫ツモは
          2000 / 4000点、親の満貫ツモは4000点オールです。
        </p>
      </article>

      <article className="guide-section" id="kuisagari">
        <h2>喰い下がり</h2>
        <p>
          三色同順、一気通貫、混一色、純全帯么九、清一色などは副露で1翻下がります。問題では副露の有無を必ず表示します。
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

function difficultyLabel(difficulty: PracticeQuestion['difficulty']): string {
  const labels: Record<PracticeQuestion['difficulty'], string> = {
    starter: '初級',
    standard: '標準',
    advanced: '応用',
    limit: '満貫以上',
  }

  return labels[difficulty]
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
