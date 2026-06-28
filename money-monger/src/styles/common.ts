/**
 * styles/common.ts — shared, theme-driven style fragments reused across screens.
 * Screen-specific styles stay local to the screen; only put genuinely shared
 * pieces here. Never hardcode hex/sizes — pull from theme/tokens.
 */
import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/tokens';

export const common = StyleSheet.create({
  // Full-screen brutalist surface, content centered.
  screenCenter: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.containerPaddingMobile,
    gap: spacing.stackLg,
  },
  // "Stamped down" press effect: shift into the offset shadow and drop it.
  pressed: {
    transform: [{ translateX: 6 }, { translateY: 6 }],
    shadowOffset: { width: 0, height: 0 },
  },
});
