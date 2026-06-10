import { Link, useNavigate } from 'react-router-dom'
import { formatRate } from '../domain/scoring'
import type { SessionStats } from '../domain/types'

type ResultsPageProps = {
  stats: SessionStats
  onReset: () => void
}

export function ResultsPage({ stats, onReset }: ResultsPageProps) {
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
