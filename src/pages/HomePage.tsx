import { Link } from 'react-router-dom'

type HomeProps = {
  completed: number
  onReset: () => void
}

export function HomePage({ completed, onReset }: HomeProps) {
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
