import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { calculateStats } from './domain/scoring'
import { generate, yakuSignature } from './domain/generator'
import { buildQuestion } from './domain/question-factory'
import { createRng } from './domain/rng'
import { HomePage } from './pages/HomePage'
import { PracticePage } from './pages/PracticePage'
import { GuidePage } from './pages/GuidePage'
import { ResultsPage } from './pages/ResultsPage'
import type {
  AnswerEvaluation, CompletedQuestion, DifficultyFilter, PracticeQuestion,
} from './domain/types'

const storageKey = 'mahjong-score-trainer-session-v3'

type StoredSession = {
  difficulty: DifficultyFilter
  completed: CompletedQuestion[]
}

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

// 直近の役構成シグネチャ（連続出題の抑止。ベストエフォート）。
// ref を render 中に読まないため、avoid を引数で渡し、ref 更新は呼び出し側で行う。
function buildPracticeQuestion(
  difficulty: DifficultyFilter,
  avoid: string[],
): { question: PracticeQuestion; signature: string } {
  const seed = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
  const rng = createRng(seed)
  const { input, result } = generate(difficulty, rng, { avoid })
  return {
    question: buildQuestion({ ...input }, result, rng),
    signature: yakuSignature(result),
  }
}

function App() {
  const [session, setSession] = useState<StoredSession>(() => loadSession())
  // 直近2問の役構成。同じ構成の連続出題を抑止する（ベストエフォート）。
  const recentSignaturesRef = useRef<string[]>([])

  function pushSignature(signature: string) {
    // StrictMode の useState 初期化二重実行で ref に2回 push されうるが、
    // avoid リストが少し厳しくなるだけで無害。
    recentSignaturesRef.current = [signature, ...recentSignaturesRef.current].slice(0, 2)
  }

  function makeQuestion(difficulty: DifficultyFilter): PracticeQuestion {
    const { question, signature } = buildPracticeQuestion(
      difficulty,
      recentSignaturesRef.current,
    )
    pushSignature(signature)
    return question
  }

  // 初回は避ける対象がないので空リストで生成。同じ生成から question と signature を得る。
  const [initial] = useState(() =>
    buildPracticeQuestion(loadSession().difficulty, []),
  )
  const [question, setQuestion] = useState<PracticeQuestion>(initial.question)

  // ref への書き込みは render 外（effect）で行う。初回問題の signature を直近履歴に積む。
  useEffect(() => {
    pushSignature(initial.signature)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        {stats.total > 0 && (
          <span className="session-chip" aria-label="今回の成績">
            {stats.total}問・正解{stats.completeCorrect}
          </span>
        )}
        <nav className="site-nav" aria-label="メインナビゲーション">
          <NavLink to="/practice">練習</NavLink>
          <NavLink to="/guide">ガイド</NavLink>
          <NavLink to="/results">結果</NavLink>
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={<HomePage completed={session.completed.length} onReset={resetSession} />}
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

export default App
