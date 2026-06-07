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

type HandViewProps = {
  tiles: TileCode[]
  winningTile: TileCode
  melds: Meld[]
}

export function HandView({ tiles, winningTile, melds }: HandViewProps) {
  return (
    <div className="hand-view" aria-label="和了牌姿">
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
