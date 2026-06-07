# Mahjong Score Trainer Design

## Product Principles

- The app teaches practical riichi mahjong scoring, not every rare table ruling at once.
- MVP scoring is based on vetted fixed questions. Random generation is a later engine feature.
- The user should know which step failed: yaku, han, fu, or payment.
- Mobile interaction takes priority. Every answer can be selected without a keyboard.

## Visual Direction

The visual theme is a bright modern mahjong parlor: warm linen backgrounds, ivory tiles, a deep green table area, walnut details, brass accents, and sober typography. The UI should feel like a serious practice tool, not a toy. Tile readability has priority over mood; the tile face must always be light because the SVG assets include transparent areas.

### Tokens

- Background: `#f5ead7`, `#e7d7bc`
- Table: `#0f4a38`
- Surface: `rgba(255, 252, 244, 0.88)`, `#fffaf0`
- Text: `#1f2d24`, `#6f604d`
- Tile ivory: `#fff8e8`
- Tile edge: `#cdb88e`
- Brass accent: `#a86e1d`
- Correct: `#257b55`
- Incorrect: `#b94a3f`
- Radius: 16px for cards, 10px for controls

## Layout

- Home: short value proposition, current MVP scope, start CTA, link to guide.
- Practice: compact context chips, tile rows, yaku multi-select, answer panels, immediate feedback.
- Result: session-only summary with total questions, complete correct rate, yaku/han/fu/payment partial rates, streak, and average response time.
- Guide: scoring flow, fu reference, limit hands, M-League rule notes, and role list.

## Tile Display

- Use public-domain SVG tile assets from `FluffyStuff/riichi-mahjong-tiles`.
- Each tile wrapper must render a light ivory face behind the SVG. Do not place transparent SVG tiles directly on a dark background.
- Tile width uses `clamp(26px, 7vw, 46px)` on the main hand.
- The winning tile is separated by a small gap and highlighted with a brass rim.
- Open melds are grouped in their own row. Called tiles may be rotated when useful, but MVP accepts grouped display without call-source rotation.
- Every tile image has an accessible Japanese label.

## Interaction

- Tap targets must be at least 44px high.
- Feedback cannot rely on color alone; use text labels and borders.
- Yaku selection is a multi-select set match. Dora is not shown as a yaku choice; it remains in the han breakdown.
- Full correct means yaku, han, required fu, and payment all match an accepted interpretation.
- For mangan-or-higher hands, fu is shown in the explanation but not required as an answer.

## Scope Boundaries

- No login, long-term history, SNS sharing, configurable rules, honba, riichi sticks, responsibility payment, or offline service worker in MVP.
- PWA install metadata is allowed later, but service-worker caching should wait until scoring is stable.
