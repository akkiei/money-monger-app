import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerRow } from "../src/components";
import { joinByCode, leaveGame } from "../src/net/session";
import { isInProgress } from "../src/state/snapshot";
import { useGameStore } from "../src/state/store";
import type { ErrorCode } from "../src/shared/types";
import { brutal, colors, spacing, typography } from "../src/theme/tokens";

const ERROR_TEXT: Partial<Record<ErrorCode, string>> = {
  ROOM_NOT_FOUND: "ROOM NOT FOUND",
  ALREADY_STARTED: "GAME ALREADY STARTED",
  ROOM_FULL: "ROOM IS FULL",
};

// Guest Waiting Room. Performs the join on mount, then renders one of three
// states from the store: connecting · error · waiting (in room). Navigates to
// /board once the host starts (phase leaves 'lobby').
export default function WaitingRoom() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; name?: string }>();

  const status = useGameStore((s) => s.status);
  const error = useGameStore((s) => s.error);
  const snapshot = useGameStore((s) => s.snapshot);
  const playerId = useGameStore((s) => s.playerId);

  const joinedRef = useRef(false);
  useEffect(() => {
    if (joinedRef.current) return;
    joinedRef.current = true;
    // joinByCode sets the store error/status on failure (rendered as the error
    // page below); swallow the rejection so the fire-and-forget call doesn't
    // surface as an uncaught error (e.g. a wrong room code → "no rooms found").
    joinByCode((params.code ?? "").toUpperCase(), params.name ?? "Player").catch(() => {});
  }, [params.code, params.name]);

  // host started → everyone moves to the board (only once we're actually in this room)
  const goingToBoard = useRef(false);
  useEffect(() => {
    if (status === "connected" && isInProgress(snapshot?.phase)) {
      goingToBoard.current = true;
      router.replace("/board");
    }
  }, [status, snapshot?.phase, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the waiting room (back, swipe, browser back, close, or buttons) frees
  // the seat so the host's roster updates — unless we're heading to the board.
  // The leave is DEFERRED + cancellable so React's dev double-mount (mount →
  // unmount → remount) doesn't leave the room the instant after joining.
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    return () => {
      if (goingToBoard.current) return;
      leaveTimer.current = setTimeout(() => void leaveGame(), 400);
    };
  }, []);

  const code = (snapshot?.code || params.code || "").toUpperCase();
  const players = snapshot?.players ?? [];

  // slow spin for the connecting / waiting indicators (core Animated — no dep)
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const top = { paddingTop: insets.top + spacing.stackLg };

  // Navigate away; the unmount cleanup frees the seat (server removes us → host updates).
  function cancel() {
    router.replace("/main-menu");
  }

  // ── error ───────────────────────────────────────────────────
  if (status === "error") {
    return (
      <View style={[styles.center, styles.errorBg, top]}>
        <View style={styles.errorMark}>
          <Text style={styles.errorMarkGlyph}>✕</Text>
        </View>
        <Text style={styles.errorTitle}>
          {ERROR_TEXT[error ?? "BAD_REQUEST"] ?? "COULDN’T JOIN"}
        </Text>
        <View style={styles.errorActions}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.btn,
              styles.btnYellow,
              styles.btnFlex,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.btnTextDark}>TRY AGAIN</Text>
          </Pressable>
          <Pressable
            onPress={cancel}
            style={({ pressed }) => [
              styles.btn,
              styles.btnLight,
              styles.btnFlex,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.btnTextDark}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── connecting (idle / connecting, no snapshot yet) ─────────
  if (status !== "connected" || !snapshot) {
    return (
      <View style={[styles.center, top]}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]}>
          <View style={styles.spinnerInner} />
        </Animated.View>
        <Text style={styles.bigTitle}>Connecting...</Text>
        <Text style={styles.subtitle}>ROOM: {code}</Text>
        <Pressable
          onPress={cancel}
          style={({ pressed }) => [
            styles.btn,
            styles.btnLight,
            styles.btnWide,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.btnTextDark}>CANCEL</Text>
        </Pressable>
      </View>
    );
  }

  // ── waiting (connected) ─────────────────────────────────────
  return (
    <View style={styles.root}>
      <View style={[styles.header, top]}>
        <Text style={styles.headerTitle}>WAITING ROOM</Text>
        <View style={styles.codeChip}>
          <Text style={styles.codeChipText}>ROOM {code}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>PLAYERS ({players.length})</Text>
        {players.map((p, i) => (
          <PlayerRow
            key={p.id}
            name={p.name || "PLAYER"}
            color={p.color}
            seatIndex={i}
            isHost={p.isHost}
            isYou={p.id === playerId}
          />
        ))}

        <View style={styles.waitingBanner}>
          <Animated.View
            style={[styles.waitDot, { transform: [{ rotate }] }]}
          />
          <Text style={styles.waitingText}>WAITING FOR HOST TO START…</Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + spacing.gutter },
        ]}
      >
        <Pressable
          onPress={cancel}
          style={({ pressed }) => [
            styles.btn,
            styles.btnRed,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.btnTextLight}>LEAVE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  // shared centered layout (connecting / error)
  center: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.gutter,
    gap: spacing.stackLg,
  },

  // connecting
  spinner: {
    width: 120,
    height: 120,
    backgroundColor: colors.tertiary,
    ...brutal.border,
    ...brutal.offset,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerInner: {
    width: 44,
    height: 44,
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.borderThin,
  },
  bigTitle: {
    ...typography.displayLg,
    color: colors.onSurface,
    textAlign: "center",
  },
  subtitle: { ...typography.headlineMd, color: colors.onSurfaceVariant },

  // error
  errorBg: { backgroundColor: colors.secondary },
  errorMark: {
    width: 96,
    height: 96,
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    ...brutal.offset,
    alignItems: "center",
    justifyContent: "center",
  },
  errorMarkGlyph: {
    ...typography.displayLg,
    fontSize: 56,
    lineHeight: 60,
    color: colors.secondary,
  },
  errorTitle: {
    ...typography.displayLg,
    fontSize: 56,
    lineHeight: 56,
    color: colors.surfaceContainerLowest,
    textAlign: "center",
  },
  errorActions: { flexDirection: "row", gap: spacing.stackMd, width: "100%" },

  // waiting (connected)
  header: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.stackMd,
    borderBottomWidth: 4,
    borderColor: colors.outline,
    alignItems: "center",
    gap: spacing.stackSm,
  },
  headerTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  codeChip: {
    backgroundColor: colors.primaryContainer,
    ...brutal.borderThin,
    paddingHorizontal: spacing.stackMd,
    paddingVertical: 4,
  },
  codeChipText: {
    ...typography.labelLg,
    color: colors.onPrimaryContainer,
    letterSpacing: 2,
  },

  content: { padding: spacing.gutter, gap: spacing.stackMd },
  sectionTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    borderBottomWidth: 4,
    borderColor: colors.outline,
    paddingBottom: spacing.stackSm,
  },

  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.stackMd,
    borderWidth: 4,
    borderColor: colors.outlineVariant,
    borderStyle: "dashed",
    padding: spacing.stackLg,
    marginTop: spacing.stackSm,
  },
  waitDot: {
    width: 18,
    height: 18,
    backgroundColor: colors.tertiary,
    ...brutal.borderThin,
  },
  waitingText: {
    ...typography.labelLg,
    color: colors.onSurfaceVariant,
    letterSpacing: 1,
  },

  footer: {
    padding: spacing.gutter,
    borderTopWidth: 4,
    borderColor: colors.outline,
  },

  // buttons
  btn: {
    paddingVertical: 16,
    alignItems: "center",
    ...brutal.border,
    ...brutal.offset,
  },
  btnWide: { width: "100%", maxWidth: 360 },
  btnFlex: { flex: 1 },
  btnLight: { backgroundColor: colors.surfaceContainerLowest },
  btnYellow: { backgroundColor: colors.primaryContainer },
  btnRed: { backgroundColor: colors.secondary },
  btnTextDark: {
    ...typography.headlineMd,
    color: colors.onSurface,
    letterSpacing: 1,
  },
  btnTextLight: {
    ...typography.headlineMd,
    color: colors.onPrimary,
    letterSpacing: 1,
  },

  pressed: {
    transform: [{ translateX: 6 }, { translateY: 6 }],
    shadowOffset: { width: 0, height: 0 },
  },
});
