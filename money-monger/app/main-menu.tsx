import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGameStore } from "../src/state/store";
import { common } from "../src/styles/common";
import { brutal, colors, spacing, typography } from "../src/theme/tokens";

// Main Menu — two entries only (multiplayer-only MVP): Start Game / Join Game.
export default function MainMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reset = useGameStore((s) => s.reset);

  // Clear any leftover session state before entering a fresh create/join flow,
  // so a stale snapshot can't trigger an early navigation to the board.
  function go(path: '/create-room' | '/join-game') {
    reset();
    router.push(path);
  }

  return (
    <View style={styles.root}>
      {/* top bar: ink mark + brand, ink bottom rule */}
      <View
        style={[styles.topbar, { paddingTop: insets.top + spacing.stackMd }]}
      >
        <View style={styles.mark} />
        <Text style={styles.brand}>MONEY MONGER</Text>
      </View>

      {/* two action cards */}
      <View style={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => go("/create-room")}
          style={({ pressed }) => [
            styles.card,
            styles.cardHero,
            pressed && common.pressed,
          ]}
        >
          <Text style={styles.heroLabel} numberOfLines={1} adjustsFontSizeToFit>
            CREATE GAME
          </Text>
          <Text style={styles.caption}>HOST A NEW GAME</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => go("/join-game")}
          style={({ pressed }) => [
            styles.card,
            styles.cardJoin,
            pressed && common.pressed,
          ]}
        >
          <Text
            style={[styles.label, styles.onBlue]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            JOIN GAME
          </Text>
          <Text style={[styles.caption, styles.onBlue]}>ENTER A ROOM CODE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.stackMd,
    paddingHorizontal: spacing.containerPaddingMobile,
    paddingBottom: spacing.stackMd,
    borderBottomWidth: 4,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  mark: { width: 28, height: 28, backgroundColor: colors.onSurface }, // ink block accent
  brand: {
    ...typography.headlineMd,
    color: colors.onSurface,
    letterSpacing: -0.5,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.gutter,
    gap: spacing.stackLg,
  },

  card: {
    ...brutal.border,
    ...brutal.offset,
    paddingHorizontal: spacing.stackLg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.stackSm,
  },
  cardHero: { backgroundColor: colors.primaryContainer, paddingVertical: 56 }, // yellow, hero
  cardJoin: { backgroundColor: colors.tertiary, paddingVertical: 36 }, // blue

  heroLabel: {
    ...typography.displayLg,
    color: colors.onPrimaryContainer,
    letterSpacing: -1,
  },
  label: { ...typography.headlineLg, color: colors.onPrimaryContainer },
  caption: {
    ...typography.labelMd,
    color: colors.onPrimaryContainer,
    letterSpacing: 2,
  },
  onBlue: { color: colors.onTertiary },
});
