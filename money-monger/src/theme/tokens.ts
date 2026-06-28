/**
 * theme/tokens.ts — the "Metro Brutalist" design system (from Google Stitch),
 * machine-readable for React Native. Source of truth: docs/design.md.
 * ALL screens/components consume these tokens — never hardcode hex/sizes.
 *
 * Brutalist: cream surfaces, thick ink borders (4px), HARD offset shadows
 * (6px, no blur), SHARP corners (radius 0), bold Space Grotesk + Inter,
 * yellow/red/blue accents.
 *
 * RN notes: sizes are dp numbers; fontWeight is encoded in the family name.
 */

export const colors = {
  surface: '#f5f0e8',
  surfaceDim: '#d6d1c9',
  surfaceBright: '#faf7f2',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2ede5',
  surfaceContainer: '#eee9e0',
  surfaceContainerHigh: '#e8e3da',
  surfaceContainerHighest: '#e2ddd4',
  surfaceVariant: '#e8e3da',
  onSurface: '#1a1a1a',
  onSurfaceVariant: '#4a4a4a',
  outline: '#1a1a1a',
  outlineVariant: '#d0cbc3',
  surfaceTint: '#1a1a1a',
  inverseSurface: '#1a1a1a',
  inverseOnSurface: '#f5f0e8',
  // primary = ink; the bright "primary action" fill is primaryContainer (yellow)
  primary: '#1a1a1a',
  onPrimary: '#ffffff',
  primaryContainer: '#ffcc00',
  onPrimaryContainer: '#1a1a1a',
  primaryFixed: '#ffcc00',
  primaryFixedDim: '#e6b800',
  onPrimaryFixed: '#1a1a1a',
  onPrimaryFixedVariant: '#1a1a1a',
  inversePrimary: '#f5f0e8',
  secondary: '#e63b2e', // red
  onSecondary: '#1a1a1a',
  secondaryContainer: '#ffdad6',
  onSecondaryContainer: '#1a1a1a',
  secondaryFixed: '#ffdad6',
  secondaryFixedDim: '#ffb3ab',
  onSecondaryFixed: '#1a1a1a',
  onSecondaryFixedVariant: '#1a1a1a',
  tertiary: '#0055ff', // blue
  onTertiary: '#ffffff',
  tertiaryContainer: '#d6e3ff',
  onTertiaryContainer: '#1a1a1a',
  tertiaryFixed: '#d6e3ff',
  tertiaryFixedDim: '#a8c6ff',
  onTertiaryFixed: '#1a1a1a',
  onTertiaryFixedVariant: '#1a1a1a',
  error: '#cc0000',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  background: '#f5f0e8',
  onBackground: '#1a1a1a',
} as const;

// Weight-specific family names — match the useFonts() keys in app/_layout.tsx.
// Space Grotesk = headlines/display/labels; Inter = body.
export const fonts = {
  grotesk400: 'SpaceGrotesk_400Regular',
  grotesk500: 'SpaceGrotesk_500Medium',
  grotesk700: 'SpaceGrotesk_700Bold',
  inter400: 'Inter_400Regular',
  inter700: 'Inter_700Bold',
} as const;

export const typography = {
  displayLg:        { fontFamily: fonts.grotesk700, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  headlineLg:       { fontFamily: fonts.grotesk700, fontSize: 32, lineHeight: 36, letterSpacing: -0.5 },
  headlineLgMobile: { fontFamily: fonts.grotesk700, fontSize: 24, lineHeight: 28 },
  headlineMd:       { fontFamily: fonts.grotesk700, fontSize: 20, lineHeight: 24 },
  bodyLg:           { fontFamily: fonts.inter700, fontSize: 18, lineHeight: 26 },
  bodyMd:           { fontFamily: fonts.inter400, fontSize: 16, lineHeight: 24 },
  labelLg:          { fontFamily: fonts.grotesk700, fontSize: 14, lineHeight: 20, letterSpacing: 1 },
  labelMd:          { fontFamily: fonts.grotesk500, fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  numberDisplay:    { fontFamily: fonts.grotesk700, fontSize: 24, lineHeight: 24 },
} as const;

// Brutalist = sharp corners. `full` kept only for genuine circles (avatars/tokens).
export const radius = {
  sm: 0,
  base: 0,
  md: 0,
  lg: 0,
  xl: 0,
  full: 9999,
} as const;

export const spacing = {
  unit: 8,
  containerPaddingMobile: 16,
  containerPaddingDesktop: 32,
  gutter: 16,
  stackSm: 8,
  stackMd: 16,
  stackLg: 24,
} as const;

// Brutalist primitives: thick ink border + HARD offset shadow (no blur).
// Spread into a style: { ...brutal.border, ...brutal.offset }.
export const brutal = {
  border: { borderWidth: 4, borderColor: colors.outline },
  borderThin: { borderWidth: 2, borderColor: colors.outline },
  offset: {
    shadowColor: colors.outline,
    shadowOffset: { width: 6, height: 6 },
    shadowRadius: 0,
    shadowOpacity: 1,
    elevation: 8,
  },
} as const;

export const theme = { colors, fonts, typography, radius, spacing, brutal } as const;
export type Theme = typeof theme;
