import { describe, expect, it } from 'vitest'
import { mapYakuName, yakuCatalog } from './yaku-map'

describe('mapYakuName', () => {
  it('maps dragon and wind yakuhai', () => {
    expect(mapYakuName('立直')?.key).toBe('riichi')
    expect(mapYakuName('翻牌 白')?.key).toBe('yakuhai-haku')
    expect(mapYakuName('場風 東')?.key).toBe('yakuhai-bakaze')
    expect(mapYakuName('自風 南')?.key).toBe('yakuhai-jikaze')
  })

  it('returns null for dora (not a selectable yaku)', () => {
    expect(mapYakuName('ドラ')).toBeNull()
    expect(mapYakuName('赤ドラ')).toBeNull()
  })

  it('every mapped key exists in the catalog', () => {
    for (const name of ['立直','平和','断幺九','混全帯幺九','清一色','二盃口','一気通貫']) {
      const m = mapYakuName(name)
      expect(m, name).not.toBeNull()
      expect(yakuCatalog[m!.key], m!.key).toBeDefined()
    }
  })
})
