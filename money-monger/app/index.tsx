import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BrutalButton, Screen } from '../src/components';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

export default function Splash() {
  const router = useRouter();

  return (
    <Screen>
      {/* corner accents */}
      <View style={[styles.corner, styles.cornerSolid]} />
      <View style={[styles.corner, styles.cornerOutline]} />

      {/* stacked-block tycoon logo: blocks → pointed roof → grey spire */}
      <View style={styles.logo}>
        <View style={[styles.block, styles.blockBase]} />
        <View style={[styles.block, styles.blockMid]} />
        {/* ink triangle behind blue triangle = brutalist outlined roof */}
        <View style={styles.roofOutline} />
        <View style={styles.roof} />
        {/* straight grey spire rising from the apex, centered */}
        <View style={styles.spire} />
      </View>

      <Text style={styles.title}>MONEY{'\n'}MONGER</Text>
      <View style={styles.rule} />

      <View style={styles.taglineWrap}>
        <Text style={styles.tagline}>BUY · BUILD · OUTLAST</Text>
      </View>

      <BrutalButton
        label="INITIATE"
        variant="primary"
        style={styles.cta}
        onPress={() => router.replace('/main-menu')}
      />

      <View style={styles.version}>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 120, height: 200, marginBottom: spacing.stackLg, alignItems: 'center', justifyContent: 'flex-end' },
  block: { position: 'absolute', ...brutal.border, ...brutal.offset },
  blockBase: { bottom: 0, width: 96, height: 72, backgroundColor: colors.secondary }, // red
  blockMid: { bottom: 70, width: 64, height: 64, backgroundColor: colors.primaryContainer }, // yellow

  // Pointed roof via the border-trick triangle; an ink triangle sits behind a
  // slightly smaller blue one to fake the 4px brutalist outline.
  roofOutline: {
    position: 'absolute',
    bottom: 134,
    width: 0,
    height: 0,
    borderLeftWidth: 28,
    borderRightWidth: 28,
    borderBottomWidth: 48,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.outline, // ink
  },
  roof: {
    position: 'absolute',
    bottom: 135,
    width: 0,
    height: 0,
    borderLeftWidth: 23,
    borderRightWidth: 23,
    borderBottomWidth: 42,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.tertiary, // blue
  },
  // straight grey antenna/spire from the apex, centered
  spire: { position: 'absolute', bottom: 179, width: 4, height: 26, backgroundColor: colors.outlineVariant },

  title: { ...typography.displayLg, color: colors.onSurface, textAlign: 'center' },
  rule: { width: 200, height: 6, backgroundColor: colors.onSurface },

  taglineWrap: {
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    paddingHorizontal: spacing.stackLg,
    paddingVertical: spacing.stackSm,
  },
  tagline: { ...typography.labelLg, color: colors.onSurfaceVariant, letterSpacing: 2 },

  cta: { marginTop: spacing.stackLg, maxWidth: 280 },

  corner: { position: 'absolute', top: 50, width: 28, height: 28 },
  cornerSolid: { left: 24, backgroundColor: colors.onSurface },
  cornerOutline: { right: 24, ...brutal.border },

  version: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.secondary, // red tag
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: colors.outline,
    paddingHorizontal: spacing.stackMd,
    paddingVertical: spacing.stackSm,
  },
  versionText: { ...typography.labelMd, color: colors.onError, letterSpacing: 2 },
});
