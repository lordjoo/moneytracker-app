# Design

Visual system for MyMoney. Direction: **warm & approachable**, light-first with a first-class warm dark mode. Implemented as two DaisyUI themes (`mymoney-light`, `mymoney-dark`) in `tailwind.config.cjs`, plus base + component styling in `src/styles.css`. All colors authored in OKLCH (converted to hex/percentages where the toolchain needs it).

## Color

Warmth lives in the **accent and ink**, not the body. Surfaces are clean near-whites / warm charcoals so dense financial data stays legible and we avoid the AI cream/sand trap.

### Brand & semantic roles
- **Primary — Terracotta/coral.** `oklch(0.64 0.15 38)` light. The brand: primary actions, active nav, selection, credit/brand moments. Distinct in hue from the expense red.
- **Secondary — Honey/amber.** Warm support accent for highlights and the "current period" emphasis.
- **Success / income — Sage emerald.** `oklch(0.60 0.11 158)`. Money in, positive deltas, goals.
- **Error / expense / over-budget — Rose-red.** `oklch(0.57 0.18 18)`. Clearly redder than the orange primary.
- **Warning** — amber; **Info** — warm blue-teal kept low-chroma so it doesn't fight the warm palette.

### Surfaces (light)
- base-100 (cards/surfaces): near-white, faint warm tint `oklch(0.99 0.004 60)`
- base-200 (page): `oklch(0.965 0.006 60)`
- base-300 (borders/hairlines): `oklch(0.90 0.008 55)`
- base-content (ink): warm near-black `oklch(0.27 0.02 45)`

### Surfaces (dark) — warm charcoal/espresso, NOT navy
- base-100: `oklch(0.205 0.012 50)`
- base-200: `oklch(0.17 0.012 50)`
- base-300: `oklch(0.275 0.012 50)`
- base-content: warm off-white `oklch(0.93 0.008 70)`
- primary brightened `oklch(0.72 0.14 40)`, success `oklch(0.70 0.12 158)`, error `oklch(0.68 0.17 22)`.

Contrast: body text and amounts verified ≥ 4.5:1 in both themes; never color-only for sign.

## Typography
- One family: **Plus Jakarta Sans** (humanist-geometric, friendly but clean) with `system-ui` fallback. Loaded in `index.html`.
- Fixed rem scale (product register), ratio ~1.2. Weights 400/500/600/700.
- **All monetary figures use `font-variant-numeric: tabular-nums`** (utility `.tnum`) so columns align and digits don't jitter.
- `text-wrap: balance` on headings.

## Shape & depth
- Soft, approachable radii: cards `1rem` (rounded-2xl), controls `0.75rem`. Pills for badges/segmented controls.
- Depth via soft, low, warm-tinted shadows + 1px hairline borders — not heavy drop shadows. Borders use base-300.
- No side-stripe borders, no gradient text, no decorative glass.

## Layout
- Mobile-first. Max content width 64rem (`max-w-5xl`). Bottom tab nav on mobile, top tab nav ≥ sm.
- Dashboard leads with ONE balance hero (net worth + assets/debt split), then secondary stats, accounts, credit, activity — varied weight, not an equal card grid.
- Account types: **cash** (asset) and **credit** (liability). Credit surfaces show owed / limit / available / utilization with a utilization meter.

## Motion
- 150–250ms, ease-out (`--ease-out-quart`). Used for state/feedback/reveal only.
- List entrances may stagger subtly. Full `prefers-reduced-motion` fallbacks (crossfade/instant).

## Z-index scale
`--z-dropdown:1000; --z-sticky:1100; --z-fab:1150; --z-backdrop:1200; --z-modal:1300; --z-toast:1400; --z-tooltip:1500` (in styles.css).
