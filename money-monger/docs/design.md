---
name: Metro Brutalist
colors:
  surface: '#f5f0e8'
  surface-dim: '#d6d1c9'
  surface-bright: '#faf7f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2ede5'
  surface-container: '#eee9e0'
  surface-container-high: '#e8e3da'
  surface-container-highest: '#e2ddd4'
  surface-variant: '#e8e3da'
  on-surface: '#1a1a1a'
  on-surface-variant: '#4a4a4a'
  outline: '#1a1a1a'
  outline-variant: '#d0cbc3'
  surface-tint: '#1a1a1a'
  inverse-surface: '#1a1a1a'
  inverse-on-surface: '#f5f0e8'
  primary: '#1a1a1a'
  on-primary: '#ffffff'
  primary-container: '#ffcc00'
  on-primary-container: '#1a1a1a'
  primary-fixed: '#ffcc00'
  primary-fixed-dim: '#e6b800'
  inverse-primary: '#f5f0e8'
  secondary: '#e63b2e'
  on-secondary: '#1a1a1a'
  secondary-container: '#ffdad6'
  on-secondary-container: '#1a1a1a'
  tertiary: '#0055ff'
  on-tertiary: '#ffffff'
  tertiary-container: '#d6e3ff'
  on-tertiary-container: '#1a1a1a'
  error: '#cc0000'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  background: '#f5f0e8'
  on-background: '#1a1a1a'
typography:
  display-lg:    { fontFamily: spaceGrotesk, fontSize: 40px, fontWeight: '700', lineHeight: 44px, letterSpacing: -1px }
  headline-lg:   { fontFamily: spaceGrotesk, fontSize: 32px, fontWeight: '700', lineHeight: 36px }
  headline-md:   { fontFamily: spaceGrotesk, fontSize: 20px, fontWeight: '700', lineHeight: 24px }
  body-lg:       { fontFamily: inter,        fontSize: 18px, fontWeight: '700', lineHeight: 26px }
  body-md:       { fontFamily: inter,        fontSize: 16px, fontWeight: '400', lineHeight: 24px }
  label-lg:      { fontFamily: spaceGrotesk, fontSize: 14px, fontWeight: '700', lineHeight: 20px, letterSpacing: 1px }
  label-md:      { fontFamily: spaceGrotesk, fontSize: 12px, fontWeight: '500', lineHeight: 16px }
  number-display:{ fontFamily: spaceGrotesk, fontSize: 24px, fontWeight: '700', lineHeight: 24px }
rounded:
  sm: 0
  DEFAULT: 0
  md: 0
  lg: 0
  xl: 0
  full: 9999px   # circles only (avatars/tokens); everything else is square
brutal:
  border-width: 4px
  border-color: '#1a1a1a'
  offset-shadow: '6px 6px 0 0 #1a1a1a'   # hard shadow, no blur
spacing:
  unit: 8px
  container-padding-mobile: 16px
  container-padding-desktop: 32px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style
**Neo-Brutalist urban tycoon.** Loud, tactile, confident — flat cream surfaces,
**thick black (#1a1a1a) borders**, **hard offset drop-shadows** (no blur), and
**sharp 0-radius** corners. Big uppercase Space Grotesk headlines, primary-color
blocks (yellow / red / blue) used as bold geometric shapes. The opposite of soft
glassmorphism: everything looks like a stamped, physical board-game piece.

## Colors
- **Cream surface (#f5f0e8):** the page background.
- **Ink (#1a1a1a):** all borders, dividers, primary text — the structural skeleton.
- **Yellow (#ffcc00, `primary-container`):** the Bank / primary actions / money.
- **Red (#e63b2e, `secondary`):** penalties, destructive actions, accents/tags.
- **Blue (#0055ff, `tertiary`):** navigation / join / neutral info.
Fills are flat (no gradients) — depth comes from borders + offset shadows, not light.

## Typography
**Space Grotesk** (700) for all headlines, labels, numbers — geometric and heavy,
usually **UPPERCASE** with wide tracking. **Inter** for body copy (400) and bold
emphasis (700). Numbers use `number-display` (Space Grotesk 700) as primary anchors.

## Shapes & Depth
- **Radius 0 everywhere** (cards, buttons, inputs, chips). Circles only for avatars/tokens.
- **Border:** 4px solid ink on every container, button, card, input, chip.
- **Elevation = hard offset shadow** `6px 6px 0 #1a1a1a` (no blur). Layer 2 (modals)
  may use a larger offset (8–10px).
- **Press feedback:** interactive elements translate by the shadow offset (e.g.
  +6/+6) and drop their shadow — the "stamped down" effect.

## Components
- **Brutal Buttons:** flat color fill (yellow primary / blue secondary / red destructive),
  4px ink border, 6px offset shadow; on press, translate +6/+6 and remove shadow.
- **Cards:** cream/white fill, 4px ink border, offset shadow; a solid color block can
  cap the top to tag a district.
- **Chips/Tags:** small flat color rectangles with ink border (e.g. version tag = red).
- **Inputs:** white fill, 4px ink border; focus = thicker/colored border (no glow).
- **Dividers:** solid ink bars (2–6px), not hairlines.

## Layout & Spacing
4-column mobile grid, 16px margins; caps to a max width on tablet/desktop. Generous
8px-unit spacing; group related data at `stack-sm` (8px), separate sections at
`stack-md`/`stack-lg` (16/24px). Asymmetry and bold blocking are encouraged.
