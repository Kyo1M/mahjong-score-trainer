export function guideLabel(anchor: string): string {
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
