export function GuidePage() {
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
