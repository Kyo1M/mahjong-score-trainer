declare module '@kobalab/majiang-core' {
  /**
   * 手牌 (hand). NOTE: `zimo` / `fulou` MUTATE the instance in place and
   * return `this` (the same object), so chaining works but the original
   * Shoupai is modified. Clone first if you need to preserve it.
   */
  export interface Shoupai {
    zimo(p: string, check?: boolean): Shoupai
    fulou(m: string, check?: boolean): Shoupai
    clone(): Shoupai
    readonly menqian: boolean
    readonly lizhi: boolean
    toString(): string
  }

  export interface ShoupaiStatic {
    fromString(paistr?: string): Shoupai
  }

  /**
   * 役 entry. `fanshu` is a number for normal yaku, or the string '*'
   * (single yakuman) / '**' (double yakuman). `baojia` only appears for
   * pao (責任払い) yakuman and is a direction marker ('+' / '=' / '-').
   */
  export interface HuleYaku {
    name: string
    fanshu: number | '*' | '**'
    baojia?: string
  }

  /**
   * Result of `Util.hule`. When the hand has NO yaku (役なし) the library
   * returns ONLY `{ defen: 0 }` — `hupai`, `fu`, `fanshu`, `damanguan`,
   * `fenpei` are all absent. For a yakuman, `fu`/`fanshu` are absent and
   * `damanguan` holds the yakuman multiplier (1, 2, ...).
   */
  export interface HuleResult {
    hupai?: HuleYaku[]
    fu?: number
    fanshu?: number
    damanguan?: number
    defen: number
    fenpei?: number[]
  }

  /**
   * Flat parameter form accepted by `Util.hule_param`. All fields are
   * optional; `hule_param` normalizes them into the nested shape that the
   * raw `Util.hule` actually consumes.
   */
  export interface HuleParamInput {
    rule?: Record<string, unknown>
    zhuangfeng?: number
    menfeng?: number
    lizhi?: number
    yifa?: boolean
    qianggang?: boolean
    lingshang?: boolean
    haidi?: number
    tianhu?: number
    baopai?: string | string[]
    fubaopai?: string | string[]
    changbang?: number
    lizhibang?: number
    [key: string]: unknown
  }

  /**
   * Normalized parameter consumed by `Util.hule`. This is what
   * `Util.hule_param` returns; passing a flat object straight to
   * `Util.hule` THROWS (it dereferences `param.hupai` and `param.jicun`).
   */
  export interface HuleParam {
    rule: Record<string, unknown>
    zhuangfeng: number
    menfeng: number
    hupai: {
      lizhi: number
      yifa: boolean
      qianggang: boolean
      lingshang: boolean
      haidi: number
      tianhu: number
    }
    baopai: string[]
    fubaopai: string[] | null
    jicun: {
      changbang: number
      lizhibang: number
    }
  }

  export interface MajiangUtil {
    /**
     * `rongpai` is `null` for tsumo. For ron it MUST carry a trailing
     * direction marker: '+' (下家), '=' (対面), '-' (上家), e.g. 'm4='.
     * Without the marker `hule` throws. `param` must be the normalized
     * form produced by `hule_param`.
     */
    hule(shoupai: Shoupai, rongpai: string | null, param: HuleParam): HuleResult
    hule_param(param?: HuleParamInput): HuleParam
    xiangting(shoupai: Shoupai): number
  }

  interface MajiangModule {
    Shoupai: ShoupaiStatic
    Util: MajiangUtil
    rule(overrides?: Record<string, unknown>): Record<string, unknown>
  }

  const Majiang: MajiangModule
  export default Majiang
}
