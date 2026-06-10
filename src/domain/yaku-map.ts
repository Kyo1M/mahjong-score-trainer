import type { AnswerChoice } from './types'

// アプリで提示する役カタログ（仕様スコープの全役）。ドラは含めない。
export const yakuCatalog: Record<string, AnswerChoice> = {
  riichi: { key: 'riichi', label: '立直' },
  'double-riichi': { key: 'double-riichi', label: 'ダブル立直' },
  ippatsu: { key: 'ippatsu', label: '一発' },
  'menzen-tsumo': { key: 'menzen-tsumo', label: '門前清自摸和' },
  pinfu: { key: 'pinfu', label: '平和' },
  tanyao: { key: 'tanyao', label: '断幺九' },
  iipeiko: { key: 'iipeiko', label: '一盃口' },
  ryanpeiko: { key: 'ryanpeiko', label: '二盃口' },
  sanshoku: { key: 'sanshoku', label: '三色同順' },
  ittsu: { key: 'ittsu', label: '一気通貫' },
  chanta: { key: 'chanta', label: '混全帯幺九' },
  junchan: { key: 'junchan', label: '純全帯幺九' },
  honitsu: { key: 'honitsu', label: '混一色' },
  chinitsu: { key: 'chinitsu', label: '清一色' },
  toitoi: { key: 'toitoi', label: '対々和' },
  sananko: { key: 'sananko', label: '三暗刻' },
  honroutou: { key: 'honroutou', label: '混老頭' },
  chiitoitsu: { key: 'chiitoitsu', label: '七対子' },
  'yakuhai-haku': { key: 'yakuhai-haku', label: '白' },
  'yakuhai-hatsu': { key: 'yakuhai-hatsu', label: '發' },
  'yakuhai-chun': { key: 'yakuhai-chun', label: '中' },
  'yakuhai-bakaze': { key: 'yakuhai-bakaze', label: '場風牌' },
  'yakuhai-jikaze': { key: 'yakuhai-jikaze', label: '自風牌' },
}

// majiang の日本語役名 → カタログキー。完全一致と接頭辞一致を併用。
const EXACT: Record<string, string> = {
  立直: 'riichi',
  ダブル立直: 'double-riichi',
  両立直: 'double-riichi',
  一発: 'ippatsu',
  門前清自摸和: 'menzen-tsumo',
  平和: 'pinfu',
  断幺九: 'tanyao',
  一盃口: 'iipeiko',
  二盃口: 'ryanpeiko',
  三色同順: 'sanshoku',
  一気通貫: 'ittsu',
  混全帯幺九: 'chanta',
  純全帯幺九: 'junchan',
  混一色: 'honitsu',
  清一色: 'chinitsu',
  対々和: 'toitoi',
  三暗刻: 'sananko',
  混老頭: 'honroutou',
  七対子: 'chiitoitsu',
}

const DRAGON: Record<string, string> = {
  白: 'yakuhai-haku',
  發: 'yakuhai-hatsu',
  中: 'yakuhai-chun',
}

export function mapYakuName(name: string): AnswerChoice | null {
  if (name === 'ドラ' || name === '赤ドラ' || name === '裏ドラ') return null
  if (EXACT[name]) return yakuCatalog[EXACT[name]]
  if (name.startsWith('場風')) return yakuCatalog['yakuhai-bakaze']
  if (name.startsWith('自風')) return yakuCatalog['yakuhai-jikaze']
  for (const [tile, key] of Object.entries(DRAGON)) {
    if (name.includes(tile)) return yakuCatalog[key]
  }
  return null
}
