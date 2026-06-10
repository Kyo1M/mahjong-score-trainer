import type { Meld, TileCode } from '../domain/types'
import { tileAssetPath, tileLabel } from '../domain/tiles'

type TileViewProps = {
  tile: TileCode
  winning?: boolean
  compact?: boolean
}

export function TileView({ tile, winning = false, compact = false }: TileViewProps) {
  return (
    <span
      className={[
        'tile',
        winning ? 'tile--winning' : '',
        compact ? 'tile--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img src={tileAssetPath(tile)} alt={tileLabel(tile)} loading="lazy" />
    </span>
  )
}

type RiichiStickProps = {
  label?: string | null
}

// 場に出した立直棒（1000点棒）。クリーム色の棒に中央の赤点。
export function RiichiStick({ label }: RiichiStickProps) {
  return (
    <span className="riichi-stick" role="img" aria-label={`${label ?? '立直'}（立直棒を場に出す）`}>
      <svg className="riichi-stick__bar" viewBox="0 0 96 18" aria-hidden="true">
        <rect x="1" y="4" width="94" height="10" rx="5" fill="#fbf7ee" stroke="#cdbfa6" />
        <circle cx="48" cy="9" r="3" fill="#cf3a3a" />
      </svg>
      <span className="riichi-stick__label">{label ?? '立直'}</span>
    </span>
  )
}

type HandViewProps = {
  tiles: TileCode[]
  winningTile: TileCode
  melds: Meld[]
  riichi?: string | null
}

export function HandView({ tiles, winningTile, melds, riichi }: HandViewProps) {
  return (
    <div className="hand-view" aria-label="和了した手牌">
      {riichi && (
        <div className="hand-view__riichi">
          <RiichiStick label={riichi} />
        </div>
      )}
      <div className="tile-row tile-row--hand">
        {tiles.map((tile, index) => (
          <TileView key={`${tile}-${index}`} tile={tile} />
        ))}
        <TileView tile={winningTile} winning />
      </div>

      {melds.length > 0 && (
        <div className="melds" aria-label="副露">
          {melds.map((meld, index) => (
            <div className="meld" key={`${meld.label}-${index}`}>
              <span className="meld__label">{meld.label}</span>
              <span className="tile-row tile-row--meld">
                {meld.tiles.map((tile, tileIndex) => (
                  <TileView key={`${tile}-${tileIndex}`} tile={tile} compact />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type DoraViewProps = {
  tiles: TileCode[]
}

export function DoraView({ tiles }: DoraViewProps) {
  return (
    <span className="dora-view">
      {tiles.map((tile, index) => (
        <TileView key={`${tile}-${index}`} tile={tile} compact />
      ))}
    </span>
  )
}
