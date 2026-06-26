import { usePreventRemove } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOARD_CONFIG, BoardTile } from '../src/config/board.config';
import { countryById, tileLabelsFor } from '../src/config/countries';
import { command, leaveGame } from '../src/net/session';
import type { StandingRow, WinReason } from '../src/shared/types';
import { activeId, DeedSnap, GameSnapshot, PlayerSnap } from '../src/state/snapshot';
import { useGameStore } from '../src/state/store';
import { boardTheme, cornerStyle, tileBandColor } from '../src/theme/boardThemes';
import { playerEmoji, tokenHex } from '../src/theme/playerColors';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

// ─── Board ring geometry: index 0 = Start (bottom-right), clockwise. 32 tiles
//     on a 9×9 perimeter; the inner 7×7 is the hollow center. ──────────────
function tilePos(i: number): { row: number; col: number } {
  if (i <= 8) return { row: 8, col: 8 - i };
  if (i <= 16) return { row: 16 - i, col: 0 };
  if (i <= 24) return { row: 0, col: i - 16 };
  return { row: i - 24, col: 8 };
}
const INDEX_AT: (number | null)[][] = Array.from({ length: 9 }, () => Array<number | null>(9).fill(null));
for (let i = 0; i < 32; i++) {
  const { row, col } = tilePos(i);
  INDEX_AT[row][col] = i;
}
const TILE_BY_INDEX = new Map<number, BoardTile>(BOARD_CONFIG.tiles.map((t) => [t.index, t]));

// How long the dice "slot reel" spins before settling on the result (ms). The
// player's token move is held until this elapses.
const DICE_SPIN_MS = 2000;

// Per-block token hop duration (ms) for the move animation.
const STEP_MS = 240;

// Emoji-token size shrinks as more players share a tile so they all fit; tiles
// are smaller on compact (small-screen) layouts, so shrink a notch further.
function tokenFontSize(count: number, compact: boolean): number {
  const base = count <= 2 ? 13 : count <= 4 ? 10 : 8;
  return compact ? Math.max(6.5, base - 1.5) : base;
}

// Most tokens shown in a cell before collapsing the rest into a "+N" chip.
const TOKEN_CAP = 4;

// Order tokens so the hopping one and YOU are always in the visible set.
function orderTokens(here: PlayerSnap[], movingId: string | null, me: string | null): PlayerSnap[] {
  const rank = (p: PlayerSnap) => (p.id === movingId ? 0 : p.id === me ? 1 : 2);
  return [...here].sort((a, b) => rank(a) - rank(b));
}

const SPECIAL_LABEL: Record<string, string> = {
  start: 'GO',
  rest_stop: 'REST',
  go_to_audit: 'GOTO',
  audit: 'AUDIT',
  tax: 'TAX',
  utility: 'UTIL',
  card_govt_notice: 'Notice',
  card_govt_grant: 'Govt Grant',
};

// Mirrors the server's canBuildOn: a player may upgrade ANY property they own
// (unmortgaged, below max level) if they can afford the build cost — no
// whole-group or even-building requirement. Shown on a later visit, never on
// the turn the tile was bought (see boughtThisTurn).
function canUpgradeTile(snapshot: GameSnapshot, me: string | null, tileIndex: number): boolean {
  if (!me) return false;
  const tile = TILE_BY_INDEX.get(tileIndex);
  if (!tile || tile.type !== 'property') return false;
  const deed = snapshot.deeds[tileIndex];
  if (!deed || deed.ownerId !== me || deed.mortgaged || deed.buildings >= 4) return false;
  const cost = BOARD_CONFIG.districts[tile.districtId]?.buildCost ?? 0;
  const cash = snapshot.players.find((p) => p.id === me)?.cash ?? 0;
  return cash >= cost;
}

// Friendly text for command rejections surfaced on the board.
const BOARD_ERROR_TEXT: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'NOT ENOUGH CASH',
  NOT_YOUR_TURN: 'NOT YOUR TURN',
  NOT_OWNER: 'YOU DON’T OWN THAT',
  ILLEGAL_ACTION: 'CAN’T DO THAT',
  INVALID_TILE: 'INVALID TILE',
};
export default function Board() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // responsive layout: small phones get a tighter feed + a board capped by
  // height so the feed never gets pushed off-screen.
  const isCompact = winH < 700;
  const feedHeight = isCompact
    ? Math.round(Math.min(96, Math.max(64, winH * 0.12)))
    : Math.round(Math.min(190, Math.max(92, winH * 0.18)));
  const boardMax = Math.min(420, winW - spacing.gutter * 2, winH * (isCompact ? 0.4 : 0.5));
  const snapshot = useGameStore((s) => s.snapshot);
  const playerId = useGameStore((s) => s.playerId);
  const room = useGameStore((s) => s.room);
  const error = useGameStore((s) => s.error);
  const setError = useGameStore((s) => s.setError);

  const router = useRouter();
  const [lastRoll, setLastRoll] = useState<{ d1: number; d2: number } | null>(null);
  // casino-style dice: numbers spin (slot reel) before settling on the result.
  // While spinning, the token move is deferred until the dice land.
  const [rolling, setRolling] = useState(false);
  const [spinId, setSpinId] = useState(0); // bumps each roll → retriggers the reel
  const rollingRef = useRef(false);
  const pendingMove = useRef<{ pid: string; path: number[] } | null>(null);
  const diceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // money dialogs that arrive mid-roll are buffered here and released only after
  // the dice land + the token finishes moving (so outcomes never precede the roll).
  const pendingMoney = useRef<{ title: string; text: string; gain: boolean }[]>([]);
  const moneyFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [quitVisible, setQuitVisible] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  // any money transaction involving the local player → an acknowledge-only
  // dialog. Queued so several transactions in one turn are each shown in turn.
  const [moneyQueue, setMoneyQueue] = useState<{ title: string; text: string; gain: boolean }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [gameEnded, setGameEnded] = useState(false);
  // tile YOU bought this turn — don't offer to upgrade it until a later visit
  const [boughtThisTurn, setBoughtThisTurn] = useState<number | null>(null);
  // one upgrade per turn: set once YOU build, cleared on turn change → the
  // UPGRADE option disappears and the turn auto-ends after a single upgrade.
  const [upgradedThisTurn, setUpgradedThisTurn] = useState(false);
  // animated, block-by-block movement: displayPos overrides a player's synced
  // position while their token walks the path; movingId marks the hopping token.
  const [displayPos, setDisplayPos] = useState<Record<string, number>>({});
  const [movingId, setMovingId] = useState<string | null>(null);
  const moveTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const moverPulse = useRef(new Animated.Value(0)).current;
  // continuous pulse for highlighting the current-turn player's owned blocks
  const ownerPulse = useRef(new Animated.Value(0)).current;
  const [feed, setFeed] = useState<{ id: number; text: string; icon: string }[]>([]);
  const feedId = useRef(0);
  const feedScrollRef = useRef<ScrollView>(null);
  const addFeed = useCallback((text: string, icon = '•') => {
    setFeed((prev) => [...prev, { id: feedId.current++, text, icon }].slice(-50));
  }, []);

  // smoothly scroll the feed to the newest entry (kept at the bottom)
  useEffect(() => {
    const t = setTimeout(() => feedScrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [feed.length]);

  // tick once a second to drive the turn countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // auto-dismiss the current money dialog after 10s (the timer resets whenever
  // the queue changes, so each dialog gets its own window before advancing).
  useEffect(() => {
    if (moneyQueue.length === 0) return;
    const t = setTimeout(() => setMoneyQueue((q) => q.slice(1)), 10000);
    return () => clearTimeout(t);
  }, [moneyQueue]);

  // Walk a player's token one block at a time along the dice path. The synced
  // snapshot already holds the final tile, so we override it with displayPos
  // (starting one tile behind path[0]) and step forward STEP_MS per block.
  const animateMove = useCallback((pid: string, path: number[]) => {
    if (!path || path.length === 0) return;
    const total = TILE_BY_INDEX.size;
    moveTimers.current.forEach(clearTimeout);
    moveTimers.current = [];
    const origin = (path[0]! - 1 + total) % total;
    setMovingId(pid);
    setDisplayPos((prev) => ({ ...prev, [pid]: origin }));
    path.forEach((idx, i) => {
      const t = setTimeout(() => {
        setDisplayPos((prev) => ({ ...prev, [pid]: idx }));
      }, STEP_MS * (i + 1));
      moveTimers.current.push(t);
    });
    // after the last hop, release the override (token tracks the snapshot again)
    const done = setTimeout(() => {
      setMovingId((cur) => (cur === pid ? null : cur));
      setDisplayPos((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
    }, STEP_MS * (path.length + 1));
    moveTimers.current.push(done);
  }, []);

  // pulse the moving token so it stands out while it hops
  useEffect(() => {
    if (!movingId) {
      moverPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(moverPulse, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(moverPulse, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [movingId, moverPulse]);

  // clear any in-flight movement timers on unmount
  useEffect(() => () => moveTimers.current.forEach(clearTimeout), []);

  // slow, continuous glow for the current-turn player's owned blocks
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ownerPulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(ownerPulse, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ownerPulse]);

  // All server broadcasts → dice / auto-play banner / activity feed. The server
  // sends structured data only; we compose display text here (names, tiles, $).
  useEffect(() => {
    if (!room) return;
    const get = () => useGameStore.getState();
    const me = () => get().playerId;
    const nameOf = (id?: string) => (id && get().snapshot?.players.find((p) => p.id === id)?.name) || 'Player';
    // address the local player as "You"; everyone else by name
    const who = (id?: string) => (id && id === me() ? 'You' : nameOf(id));
    const whoPoss = (id?: string) => (id && id === me() ? 'Your' : `${nameOf(id)}'s`);
    const country = () => get().snapshot?.countryId ?? 'india';
    const cur = () => countryById(country())?.currency.symbol ?? '';
    const tn = (i: number) => tileLabelsFor(country())[i]?.name ?? (TILE_BY_INDEX.get(i)?.type ?? 'tile').replace(/_/g, ' ').toUpperCase();
    const offs: Array<() => void> = [];
    const on = <T,>(type: string, fn: (m: T) => void) => offs.push(room.onMessage(type, fn));
    // queue an acknowledge-only dialog for a money transaction involving YOU.
    // During a dice roll it's buffered and released after the roll/move finish.
    const pushMoney = (title: string, gain: boolean, text: string) => {
      const item = { title, gain, text };
      if (rollingRef.current) pendingMoney.current.push(item);
      else setMoneyQueue((q) => [...q, item]);
    };

    on<{ die1: number; die2: number; playerId: string }>('ROLL_RESULT', (m) => {
      setLastRoll({ d1: m.die1, d2: m.die2 });
      addFeed(`${who(m.playerId)} rolled ${m.die1} + ${m.die2}`, '🎲');
      // spin the dice; the token move (queued by MOVE) waits until they land
      rollingRef.current = true;
      setRolling(true);
      setSpinId((s) => s + 1);
      if (diceTimer.current) clearTimeout(diceTimer.current);
      diceTimer.current = setTimeout(() => {
        rollingRef.current = false;
        setRolling(false);
        const pm = pendingMove.current;
        pendingMove.current = null;
        // release the buffered outcome dialog(s) — never before the roll lands
        const flushMoney = () => {
          if (!pendingMoney.current.length) return;
          const items = pendingMoney.current;
          pendingMoney.current = [];
          setMoneyQueue((q) => [...q, ...items]);
        };
        if (moneyFlushTimer.current) clearTimeout(moneyFlushTimer.current);
        if (pm) {
          animateMove(pm.pid, pm.path); // now move the player
          // ...then show the outcome once the token has walked to its tile
          moneyFlushTimer.current = setTimeout(flushMoney, STEP_MS * (pm.path.length + 1));
        } else {
          flushMoney();
        }
      }, DICE_SPIN_MS);
    });
    on<{ playerId: string; path: number[]; passedStart: boolean }>('MOVE', (m) => {
      const dest = m.path[m.path.length - 1];
      if (rollingRef.current) {
        // hold the move until the dice finish — and pin the token to its ORIGIN
        // so the synced (already-final) position doesn't make it jump ahead.
        pendingMove.current = { pid: m.playerId, path: m.path };
        const total = TILE_BY_INDEX.size;
        const origin = (m.path[0]! - 1 + total) % total;
        setDisplayPos((prev) => ({ ...prev, [m.playerId]: origin }));
      } else {
        animateMove(m.playerId, m.path);
      }
      if (dest !== undefined) addFeed(`${who(m.playerId)} landed on ${tn(dest)}${m.passedStart ? ' (passed GO)' : ''}`, m.passedStart ? '🏁' : '📍');
    });
    on<{ playerId: string }>('TURN_CHANGED', (m) => addFeed(`${whoPoss(m.playerId)} turn`, '🔄'));
    on<{ playerId: string }>('AUTO_PLAY', (m) => {
      setAutoMsg(`AI TOOK ${whoPoss(m.playerId).toUpperCase()} TURN`);
      setTimeout(() => setAutoMsg(null), 4000);
      addFeed(`AI played ${whoPoss(m.playerId).toLowerCase() === 'your' ? 'your' : `${nameOf(m.playerId)}'s`} turn`, '🤖');
    });
    on<{ playerId: string; tileIndex: number; price: number }>('PURCHASE', (m) => {
      addFeed(`${who(m.playerId)} bought ${tn(m.tileIndex)} from Bank for ${cur()}${m.price}`, '🏠');
      if (m.playerId === me()) {
        setBoughtThisTurn(m.tileIndex);
        pushMoney('PROPERTY BOUGHT', true, `You paid ${cur()}${m.price} to the Bank for ${tn(m.tileIndex)}.`);
      }
    });
    on<{ payerId: string; receiverId: string; amount: number }>('RENT_CHARGED', (m) => {
      addFeed(`${who(m.payerId)} paid ${cur()}${m.amount} rent to ${who(m.receiverId)}`, cur());
      if (m.payerId === me()) {
        pushMoney('RENT PAID', false, `You paid ${cur()}${m.amount} rent to ${nameOf(m.receiverId)}.`);
      } else if (m.receiverId === me()) {
        pushMoney('RENT RECEIVED', true, `${nameOf(m.payerId)} paid you ${cur()}${m.amount} rent.`);
      }
    });
    on<{ playerId: string; amount: number }>('TAX_PAID', (m) => {
      addFeed(`${who(m.playerId)} paid ${cur()}${m.amount} tax to Bank`, cur());
      if (m.playerId === me()) pushMoney('TAX PAID', false, `You paid ${cur()}${m.amount} tax to the Bank.`);
    });
    on<{ playerId: string; amount: number }>('SALARY_PAID', (m) => {
      addFeed(`Bank paid ${who(m.playerId)} ${cur()}${m.amount} salary`, cur());
      if (m.playerId === me()) pushMoney('SALARY', true, `The Bank paid you ${cur()}${m.amount} salary.`);
    });
    on<{ tileIndex: number }>('AUCTION_STARTED', (m) => {
      const s = get().snapshot;
      const passer = s ? who(s.turnOrder[s.turnIndex]) : 'Player';
      addFeed(`${passer} passed — ${tn(m.tileIndex)} to auction`, '🔨');
    });
    on<{ winnerId: string | null; amount: number }>('AUCTION_WON', (m) => {
      addFeed(m.winnerId ? `${who(m.winnerId)} won the auction for ${cur()}${m.amount}` : 'Auction passed — no bids', '🔨');
      if (m.winnerId && m.winnerId === me()) pushMoney('AUCTION WON', true, `You won the auction for ${cur()}${m.amount}.`);
    });
    on<{ playerId: string; delta: number }>('CARD_DRAWN', (m) => {
      const amt = m.delta !== 0 ? ` (${m.delta > 0 ? '+' : '−'}${cur()}${Math.abs(m.delta)})` : '';
      addFeed(`${who(m.playerId)} drew a card${amt}`, m.delta !== 0 ? cur() : '🃏');
      if (m.playerId === me() && m.delta !== 0) {
        const abs = Math.abs(m.delta);
        pushMoney('CARD', m.delta > 0, m.delta > 0 ? `Lucky card paid you ${cur()}${abs}.` : `Unlucky card charged you ${cur()}${abs}.`);
      }
    });
    on<{ playerId: string; tileIndex: number; buildings: number }>('BUILD_CHANGED', (m) => {
      addFeed(`${who(m.playerId)} built on ${tn(m.tileIndex)} (lvl ${m.buildings})`, '🏗️');
      if (m.playerId === me()) setUpgradedThisTurn(true); // one upgrade per turn
    });
    on<{ playerId: string; tileIndex: number; mortgaged: boolean }>('MORTGAGE_CHANGED', (m) => addFeed(`${who(m.playerId)} ${m.mortgaged ? 'mortgaged' : 'unmortgaged'} ${tn(m.tileIndex)}`, '🏦'));
    on<{ playerId: string }>('AUDIT_APPLIED', (m) => addFeed(`${who(m.playerId)} sent to audit`, '🚨'));
    on<{ playerId: string }>('AUDIT_RESOLVED', (m) => addFeed(`${who(m.playerId)} cleared audit`, '✅'));
    on<{ playerId: string }>('BANKRUPTCY', (m) => addFeed(`${who(m.playerId)} went bankrupt`, '💥'));
    on<{ winnerId: string | null; reason: WinReason; standings: StandingRow[] }>('GAME_OVER', (m) => {
      addFeed(m.winnerId ? `${who(m.winnerId)} ${m.winnerId === me() ? 'win' : 'wins'} the game!` : 'Game over', '👑');
      get().setResult({ winnerId: m.winnerId, reason: m.reason, standings: m.standings ?? [] });
      setGameEnded(true);
    });

    return () => offs.forEach((off) => off());
  }, [room, addFeed, animateMove]);

  // clear the dice when the turn passes to another player (fresh turn = no dice)
  const activeTurnId = snapshot ? snapshot.turnOrder[snapshot.turnIndex] ?? null : null;
  useEffect(() => {
    setLastRoll(null);
    setBoughtThisTurn(null);
    setUpgradedThisTurn(false);
    // a new turn cancels any in-flight spin/deferred move from the prior one
    if (diceTimer.current) {
      clearTimeout(diceTimer.current);
      diceTimer.current = null;
    }
    rollingRef.current = false;
    pendingMove.current = null;
    setRolling(false);
  }, [activeTurnId]);

  // clear the dice spin + money-flush timers on unmount
  useEffect(() => () => {
    if (diceTimer.current) clearTimeout(diceTimer.current);
    if (moneyFlushTimer.current) clearTimeout(moneyFlushTimer.current);
  }, []);

  // surface a rejected command (e.g. illegal build) as a transient banner
  useEffect(() => {
    if (!error) return;
    setAutoMsg(BOARD_ERROR_TEXT[error] ?? 'ACTION NOT ALLOWED');
    const t = setTimeout(() => {
      setAutoMsg(null);
      setError(null);
    }, 2500);
    return () => clearTimeout(t);
  }, [error, setError]);

  // Auto-end the turn when there's genuinely nothing left to do (rolled, no
  // decision pending, not on an upgradeable property of yours) — no manual tap.
  useEffect(() => {
    if (!snapshot || activeId(snapshot) !== playerId) return;
    if (rolling) return; // wait for the dice to land + token to move first
    if (snapshot.awaitingRoll) return;
    if (snapshot.pendingPurchase || snapshot.pendingRaise || snapshot.pendingAuction || snapshot.pendingVote) return;
    const meP = snapshot.players.find((p) => p.id === playerId);
    if (!meP || meP.auditTurnsLeft > 0) return;
    const canUpgrade = !upgradedThisTurn && meP.position !== boughtThisTurn && canUpgradeTile(snapshot, playerId, meP.position);
    if (canUpgrade) return;
    const t = setTimeout(() => command('END_TURN', undefined), 1200);
    return () => clearTimeout(t);
  }, [snapshot, playerId, boughtThisTurn, upgradedThisTurn, rolling]);

  // Block leaving mid-game (Android back, iOS swipe, header back, browser back)
  // → show the quit dialog instead. Only while actually connected: a fresh
  // reload (no room) must be free to redirect to the splash to re-join.
  usePreventRemove(!quitting && !gameEnded && !!room, () => setQuitVisible(true));

  // Reload landed here with no live connection (e.g. web page refresh) → bounce
  // to the splash, which offers to re-join the active game from the saved pointer.
  useEffect(() => {
    if (!room && !quitting && !gameEnded) router.replace('/');
  }, [room, quitting, gameEnded, router]);

  // game finished → go to the standings screen
  useEffect(() => {
    if (gameEnded) router.replace('/game-over');
  }, [gameEnded, router]);

  useEffect(() => {
    if (!quitting) return;
    // Leave in the background and navigate immediately — never block EXIT on the
    // socket close (which can hang if the connection is already dead).
    void leaveGame();
    router.replace('/main-menu');
  }, [quitting, router]);

  // Web: warn on tab close / refresh while in a game.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w = globalThis as unknown as {
      addEventListener: (t: string, h: (e: { preventDefault: () => void; returnValue: string }) => void) => void;
      removeEventListener: (t: string, h: (e: { preventDefault: () => void; returnValue: string }) => void) => void;
    };
    const handler = (e: { preventDefault: () => void; returnValue: string }) => {
      e.preventDefault();
      e.returnValue = '';
    };
    w.addEventListener('beforeunload', handler);
    return () => w.removeEventListener('beforeunload', handler);
  }, []);

  if (!snapshot) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>LOADING…</Text>
      </View>
    );
  }

  const sym = countryById(snapshot.countryId)?.currency.symbol ?? '';
  const labels = tileLabelsFor(snapshot.countryId);
  const players = snapshot.players;
  const colorOf: Record<string, string> = {};
  const emojiOf: Record<string, string> = {};
  players.forEach((p, i) => {
    colorOf[p.id] = tokenHex(p.color, i);
    emojiOf[p.id] = playerEmoji(p.color, i);
  });

  const me = players.find((p) => p.id === playerId);
  const turnId = activeId(snapshot);
  const turnPlayer = players.find((p) => p.id === turnId);
  const isMyTurn = turnId === playerId;
  const turnName = turnPlayer?.name ?? '';
  const roundsLabel = snapshot.maxRounds < 0 ? '∞' : String(snapshot.maxRounds);

  // turn countdown — only for the active online human (offline/AI seats auto-play fast)
  const showTimer = !!turnPlayer && turnPlayer.connection === 'online' && !turnPlayer.isAI && snapshot.turnEndsAt > 0;
  const secondsLeft = showTimer ? Math.max(0, Math.round((snapshot.turnEndsAt - now) / 1000)) : null;
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // every tile gets a top band colored by the active theme (property = district
  // color, special tiles = per-type color); owned properties override with the
  // owner's color.
  const theme = boardTheme(snapshot.themeId);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.stackSm }]}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.brand}>MONEY MONGER</Text>
        <View style={styles.roundChip}>
          <Text style={styles.roundChipText}>
            ROUND {snapshot.round}/{roundsLabel}
          </Text>
        </View>
        <Pressable onPress={() => setQuitVisible(true)} style={({ pressed }) => [styles.exitBtn, pressed && styles.pressed]}>
          <Text style={styles.exitText}>EXIT</Text>
        </Pressable>
      </View>

      {/* current user's stats */}
      {me && (
        <View style={[styles.meBar, isCompact && styles.meBarCompact]}>
          <View style={[styles.swatch, isCompact && styles.swatchCompact, { backgroundColor: colorOf[me.id] }]} />
          <Text style={[styles.meName, isCompact && styles.meNameCompact]}>{me.name || 'YOU'}</Text>
          <Text style={[styles.meCash, isCompact && styles.meCashCompact]}>
            {sym}
            {me.cash}
          </Text>
        </View>
      )}

      {/* board */}
      <View style={[styles.boardWrap, isCompact && styles.boardWrapCompact]}>
        <View style={[styles.board, { maxWidth: boardMax }]}>
          {INDEX_AT.map((rowArr, r) => (
            <View key={r} style={styles.boardRow}>
              {rowArr.map((idx, c) => {
                if (idx === null) return <View key={c} style={styles.cellEmpty} />;
                const tile = TILE_BY_INDEX.get(idx);
                const ownerId = snapshot.deeds[idx]?.ownerId;
                const ownerColor = ownerId ? colorOf[ownerId] : undefined;
                const buildings = snapshot.deeds[idx]?.buildings ?? 0; // 0 = no stars
                // The top band shows the themed color until bought, then the
                // owner's color — the block fill itself never changes.
                const bandColor = ownerColor ?? tileBandColor(theme);
                // Special tiles keep their tag; ownable tiles show their place name.
                const label = tile && tile.type !== 'property' ? SPECIAL_LABEL[tile.type] : labels[idx]?.name;
                const here = players.filter((p) => (displayPos[p.id] ?? p.position) === idx);
                // the four corners get a full-tile colored design (emoji + label)
                const corner = cornerStyle(theme, idx, tile);
                return (
                  <Pressable key={c} style={[styles.cell, corner ? { backgroundColor: corner.bg } : null]} onPress={() => setSelected(idx)}>
                    {corner ? (
                      corner.image ? (
                        <Image source={corner.image} style={styles.cornerImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.cornerInner} pointerEvents="none">
                          <Text style={styles.cornerEmoji}>{corner.emoji}</Text>
                          {!!corner.label && <Text style={[styles.cornerLabel, { color: corner.fg }]}>{corner.label}</Text>}
                        </View>
                      )
                    ) : (
                      <>
                        {/* top band: theme color initially → owner's color once bought */}
                        {bandColor && <View style={[styles.stripe, { backgroundColor: bandColor }]} />}
                        {/* one star per building level (level 0 → no stars) */}
                        {buildings > 0 && (
                          <Text style={styles.cellStars} numberOfLines={1}>
                            {'★'.repeat(buildings)}
                          </Text>
                        )}
                        {/* pulsing ring on tiles owned by whoever's turn it is */}
                        {!!ownerId && ownerId === turnId && (
                          <Animated.View
                            pointerEvents="none"
                            style={[styles.ownerGlow, { opacity: ownerPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }]}
                          />
                        )}
                        {label && here.length === 0 && (
                          <Text style={styles.cellLabel} numberOfLines={2}>
                            {label}
                          </Text>
                        )}
                      </>
                    )}
                    {here.length > 0 && (() => {
                      // cap visible tokens; collapse the rest into a "+N" chip.
                      // Tapping the tile opens the modal with the full roster.
                      const ordered = orderTokens(here, movingId, playerId);
                      const visible = here.length <= TOKEN_CAP ? ordered : ordered.slice(0, TOKEN_CAP - 1);
                      const overflow = here.length - visible.length;
                      const fs = tokenFontSize(visible.length + (overflow > 0 ? 1 : 0), isCompact);
                      const sized = { fontSize: fs, lineHeight: fs + 2 };
                      return (
                        <View style={styles.tokenRow}>
                          {visible.map((p) =>
                            movingId === p.id ? (
                              <Animated.Text
                                key={p.id}
                                style={[
                                  styles.token,
                                  sized,
                                  styles.tokenMoving,
                                  { transform: [{ scale: moverPulse.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1.9] }) }] },
                                ]}
                              >
                                {emojiOf[p.id]}
                              </Animated.Text>
                            ) : (
                              <Text key={p.id} style={[styles.token, sized]}>
                                {emojiOf[p.id]}
                              </Text>
                            ),
                          )}
                          {overflow > 0 && (
                            <Text style={[styles.tokenOverflow, { fontSize: Math.max(6, fs - 1) }]}>+{overflow}</Text>
                          )}
                        </View>
                      );
                    })()}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.centerMark}>MM</Text>
          </View>
        </View>
      </View>

      {/* middle band: turn + dice + roll */}
      <View style={[styles.band, isCompact && styles.bandCompact]}>
        {autoMsg && (
          <View style={styles.autoBanner}>
            <Text style={styles.autoText}>{autoMsg}</Text>
          </View>
        )}
        <View style={styles.turnRow}>
          <Text style={[styles.turnText, isCompact && styles.turnTextCompact]}>{isMyTurn ? 'YOUR TURN' : `${turnName}'S TURN`}</Text>
          {secondsLeft !== null && (
            <View style={[styles.timerChip, secondsLeft <= 10 && styles.timerChipUrgent]}>
              <Text style={[styles.timerText, secondsLeft <= 10 && styles.timerTextUrgent]}>{fmtTime(secondsLeft)}</Text>
            </View>
          )}
        </View>
        {lastRoll && (
          <View style={styles.diceRow}>
            <DieReel value={lastRoll.d1} spinId={spinId} compact={isCompact} />
            <DieReel value={lastRoll.d2} spinId={spinId} compact={isCompact} />
            {!rolling && <Text style={styles.diceTotal}>= {lastRoll.d1 + lastRoll.d2}</Text>}
          </View>
        )}
        {/* hold the action controls until the dice land + the token moves */}
        {rolling ? (
          <Text style={styles.waitText}>ROLLING…</Text>
        ) : (
          <TurnControls snapshot={snapshot} playerId={playerId} sym={sym} labels={labels} boughtThisTurn={boughtThisTurn} upgradedThisTurn={upgradedThisTurn} />
        )}
      </View>

      {/* activity feed (scrollable, newest at the bottom) */}
      <View style={[styles.feed, { height: feedHeight + insets.bottom, paddingBottom: insets.bottom + spacing.stackSm }]}>
        <View style={[styles.feedHead, isCompact && styles.feedHeadCompact]}>
          <Text style={styles.feedHeadText}>NEWS FEED</Text>
        </View>
        <ScrollView ref={feedScrollRef} style={styles.feedScroll} contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator>
          {feed.length === 0 ? (
            <Text style={styles.feedEmpty}>The game has just started. Make your move!</Text>
          ) : (
            feed.map((e, i) => (
              <View key={e.id} style={[styles.feedRow, isCompact && styles.feedRowCompact, i === feed.length - 1 && styles.feedRowNew]}>
                <Text style={[styles.feedIcon, isCompact && styles.feedIconCompact]}>{e.icon}</Text>
                <Text style={[styles.feedLine, isCompact && styles.feedLineCompact]} numberOfLines={2}>
                  {e.text}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* tile detail popup */}
      <TileModal index={selected} onClose={() => setSelected(null)} sym={sym} labels={labels} players={players} deeds={snapshot.deeds} themeId={snapshot.themeId} />

      {/* quit confirmation */}
      <Modal visible={quitVisible} transparent animationType="fade" onRequestClose={() => setQuitVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>QUIT GAME?</Text>
            <Text style={styles.modalSub}>YOU’LL LEAVE THIS GAME AND RETURN TO THE MENU.</Text>
            <View style={styles.quitActions}>
              <Pressable
                onPress={() => {
                  setQuitVisible(false);
                  setQuitting(true);
                }}
                style={({ pressed }) => [styles.quitBtn, styles.quitBtnRed, pressed && styles.pressed]}
              >
                <Text style={styles.quitBtnTextLight}>QUIT</Text>
              </Pressable>
              <Pressable onPress={() => setQuitVisible(false)} style={({ pressed }) => [styles.quitBtn, styles.quitBtnLight, pressed && styles.pressed]}>
                <Text style={styles.quitBtnText}>STAY</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* money transaction acknowledgement (any trx involving the local player) */}
      <Modal
        visible={moneyQueue.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setMoneyQueue((q) => q.slice(1))}
      >
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, moneyQueue[0]?.gain ? styles.moneyCardGain : styles.moneyCardLoss]}>
            <View style={styles.moneyHead}>
              <Text style={[styles.modalTitle, moneyQueue[0]?.gain ? styles.moneyTitleGain : styles.moneyTitleLoss]}>{moneyQueue[0]?.title}</Text>
            </View>
            <Text style={styles.rentMsg}>{moneyQueue[0]?.text}</Text>
            <Pressable onPress={() => setMoneyQueue((q) => q.slice(1))} style={({ pressed }) => [styles.quitBtn, moneyQueue[0]?.gain ? styles.moneyOkGain : styles.moneyOkLoss, pressed && styles.pressed]}>
              <Text style={styles.moneyOkText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Slot-machine die: a vertical reel of faces that scrolls top→bottom and
//     decelerates to land on `value`. Re-spins whenever `spinId` changes. ────
const DIE_FACES = [1, 2, 3, 4, 5, 6];
function DieReel({ value, spinId, compact }: { value: number; spinId: number; compact: boolean }) {
  const size = compact ? 32 : 40;
  const y = useRef(new Animated.Value(0)).current;
  // result first, then a few face-cycles below it: we start showing the bottom
  // of the strip and slide DOWN to the top, so numbers fall top→bottom and the
  // reel lands on the result (cell 0).
  const strip = useMemo(() => {
    const arr: number[] = [value];
    for (let r = 0; r < 4; r++) arr.push(...DIE_FACES);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, spinId]);
  useEffect(() => {
    const startY = -(strip.length - 1) * size; // bottom of the strip in view
    y.setValue(startY);
    Animated.timing(y, {
      toValue: 0, // slide down to the result at the top
      duration: DICE_SPIN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);
  return (
    <View style={[styles.die, compact && styles.dieCompact, styles.dieReel]}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        {strip.map((n, i) => (
          <View key={i} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={styles.dieNum}>{n}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

// ─── Turn action panel: drives the whole turn loop from synced state ───────
function TurnControls({
  snapshot,
  playerId,
  sym,
  labels,
  boughtThisTurn,
  upgradedThisTurn,
}: {
  snapshot: GameSnapshot;
  playerId: string | null;
  sym: string;
  labels: Record<number, { name: string; region: string; tier: number }>;
  upgradedThisTurn: boolean;
  boughtThisTurn: number | null;
}) {
  const me = playerId;
  const turnId = activeId(snapshot);
  const myTurn = !!me && turnId === me;
  const mePlayer = snapshot.players.find((p) => p.id === me);
  const { pendingPurchase: pp, pendingAuction: auc, pendingRaise: raise, pendingVote: vote } = snapshot;

  const tileName = (i: number) => labels[i]?.name ?? 'PROPERTY';
  const tilePrice = (i: number) => {
    const t = TILE_BY_INDEX.get(i);
    return t && (t.type === 'property' || t.type === 'utility') ? t.price : 0;
  };

  const [bid, setBid] = useState(0);
  useEffect(() => {
    if (auc) setBid(tilePrice(auc.tileIndex));
  }, [auc?.tileIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1. round-limit continue vote (everyone)
  if (vote) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>ROUND LIMIT — CONTINUE?</Text>
        <View style={styles.panelRow}>
          <Pressable onPress={() => command('VOTE_CONTINUE', { choice: 'continue' })} style={({ pressed }) => [styles.actBtn, styles.btnBlue, pressed && styles.pressed]}>
            <Text style={styles.actTextLight}>CONTINUE</Text>
          </Pressable>
          <Pressable onPress={() => command('VOTE_CONTINUE', { choice: 'end' })} style={({ pressed }) => [styles.actBtn, styles.btnRed, pressed && styles.pressed]}>
            <Text style={styles.actTextLight}>END</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 2. sealed-bid auction (eligible & not yet submitted)
  if (auc && me && auc.eligibleIds.includes(me) && !auc.submittedIds.includes(me)) {
    const max = mePlayer?.cash ?? 0;
    const min = tilePrice(auc.tileIndex);
    const clamp = (v: number) => Math.max(min, Math.min(max, v));
    return (
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>AUCTION · {tileName(auc.tileIndex)}</Text>
        <View style={styles.panelRow}>
          <Pressable onPress={() => setBid((b) => clamp(b - 10))} style={styles.stepBtn}>
            <Text style={styles.stepText}>–</Text>
          </Pressable>
          <Text style={styles.bidText}>
            {sym}
            {bid}
          </Text>
          <Pressable onPress={() => setBid((b) => clamp(b + 10))} style={styles.stepBtn}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
        <View style={styles.panelRow}>
          <Pressable onPress={() => command('BID', { amount: bid })} style={({ pressed }) => [styles.actBtn, styles.btnYellow, pressed && styles.pressed]}>
            <Text style={styles.actText}>BID</Text>
          </Pressable>
          <Pressable onPress={() => command('FOLD', undefined)} style={({ pressed }) => [styles.actBtn, styles.btnLight, pressed && styles.pressed]}>
            <Text style={styles.actText}>FOLD</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (auc) return <Text style={styles.waitText}>AUCTION IN PROGRESS…</Text>;

  // 3. raise funds (I owe money)
  if (raise && raise.playerId === me) {
    const myDeeds = Object.values(snapshot.deeds).filter((d) => d.ownerId === me && !d.mortgaged);
    return (
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>
          RAISE {sym}
          {raise.amount}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.panelRow}>
          {myDeeds.map((d) => (
            <Pressable key={d.tileIndex} onPress={() => command('MORTGAGE', { tileIndex: d.tileIndex })} style={styles.mtgChip}>
              <Text style={styles.mtgChipText}>{tileName(d.tileIndex)}</Text>
              <Text style={styles.mtgChipSub}>MORTGAGE</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.panelRow}>
          <Pressable onPress={() => command('RAISE_FUNDS_DONE', undefined)} style={({ pressed }) => [styles.actBtn, styles.btnYellow, pressed && styles.pressed]}>
            <Text style={styles.actText}>DONE</Text>
          </Pressable>
          <Pressable onPress={() => command('DECLARE_BANKRUPTCY', undefined)} style={({ pressed }) => [styles.actBtn, styles.btnRed, pressed && styles.pressed]}>
            <Text style={styles.actTextLight}>BANKRUPT</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!myTurn) return <Text style={styles.waitText}>WAITING…</Text>;

  // 4a. buy / pass the property just landed on
  if (pp && pp.playerId === me) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>
          {tileName(pp.tileIndex)} · {sym}
          {tilePrice(pp.tileIndex)}
        </Text>
        <View style={styles.panelRow}>
          <Pressable onPress={() => command('BUY', { tileIndex: pp.tileIndex })} style={({ pressed }) => [styles.actBtn, styles.btnYellow, pressed && styles.pressed]}>
            <Text style={styles.actText}>BUY</Text>
          </Pressable>
          <Pressable onPress={() => command('PASS', { tileIndex: pp.tileIndex })} style={({ pressed }) => [styles.actBtn, styles.btnLight, pressed && styles.pressed]}>
            <Text style={styles.actText}>PASS</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 4b. under audit — resolve, or roll for doubles to escape
  if ((mePlayer?.auditTurnsLeft ?? 0) > 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>UNDER AUDIT</Text>
        <View style={styles.panelRow}>
          {snapshot.awaitingRoll && (
            <Pressable onPress={() => command('ROLL', undefined)} style={({ pressed }) => [styles.actBtn, styles.btnYellow, pressed && styles.pressed]}>
              <Text style={styles.actText}>ROLL</Text>
            </Pressable>
          )}
          <Pressable onPress={() => command('RESOLVE_AUDIT', { choice: 'pay' })} style={({ pressed }) => [styles.actBtn, styles.btnLight, pressed && styles.pressed]}>
            <Text style={styles.actText}>PAY</Text>
          </Pressable>
          {(mePlayer?.clearanceCards ?? 0) > 0 && (
            <Pressable onPress={() => command('RESOLVE_AUDIT', { choice: 'card' })} style={({ pressed }) => [styles.actBtn, styles.btnBlue, pressed && styles.pressed]}>
              <Text style={styles.actTextLight}>CARD</Text>
            </Pressable>
          )}
          <Pressable onPress={() => command('RESOLVE_AUDIT', { choice: 'wait' })} style={({ pressed }) => [styles.actBtn, styles.btnLight, pressed && styles.pressed]}>
            <Text style={styles.actText}>WAIT</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 4c. roll (turn start or doubles)
  if (snapshot.awaitingRoll) {
    return (
      <Pressable onPress={() => command('ROLL', undefined)} style={({ pressed }) => [styles.roll, pressed && styles.pressed]}>
        <Text style={styles.rollText}>ROLL DICE</Text>
      </Pressable>
    );
  }

  // 4d. standing on a property you own → offer to upgrade (build), then end turn
  const hereDeed = mePlayer ? snapshot.deeds[mePlayer.position] : undefined;
  const hereTile = mePlayer ? TILE_BY_INDEX.get(mePlayer.position) : undefined;
  const canUpgrade = !upgradedThisTurn && mePlayer != null && mePlayer.position !== boughtThisTurn && canUpgradeTile(snapshot, me, mePlayer.position);
  if (canUpgrade && hereTile?.type === 'property') {
    const cost = BOARD_CONFIG.districts[hereTile.districtId]?.buildCost ?? 0;
    return (
      <View style={styles.panel}>
        <Text style={styles.panelLabel}>
          {tileName(mePlayer!.position)} · LVL {hereDeed!.buildings} → {sym}
          {cost}
        </Text>
        <View style={styles.panelRow}>
          <Pressable onPress={() => command('BUILD', { tileIndex: mePlayer!.position })} style={({ pressed }) => [styles.actBtn, styles.btnYellow, pressed && styles.pressed]}>
            <Text style={styles.actText}>UPGRADE</Text>
          </Pressable>
          <Pressable onPress={() => command('END_TURN', undefined)} style={({ pressed }) => [styles.actBtn, styles.btnLight, pressed && styles.pressed]}>
            <Text style={styles.actText}>SKIP</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // 4e. nothing left to do → the turn auto-ends (no manual button needed)
  return <Text style={styles.waitText}>ENDING TURN…</Text>;
}

// ─── Tile detail popup ─────────────────────────────────────────
function TileModal({
  index,
  onClose,
  sym,
  labels,
  players,
  deeds,
  themeId,
}: {
  index: number | null;
  onClose: () => void;
  sym: string;
  labels: Record<number, { name: string; region: string; tier: number }>;
  players: PlayerSnap[];
  deeds: Record<number, DeedSnap>;
  themeId?: string;
}) {
  const open = index !== null;
  const tile = index !== null ? TILE_BY_INDEX.get(index) : undefined;
  if (!tile || index === null) {
    return <Modal visible={false} transparent />;
  }

  const deed = deeds[index];
  const title = labels[index]?.name ?? SPECIAL_LABEL[tile.type] ?? tile.type.toUpperCase();
  const ownerId = deed?.ownerId;
  const owner = ownerId ? (players.find((p) => p.id === ownerId)?.name ?? 'OWNED') : 'BANK';
  const stripe = tileBandColor(boardTheme(themeId));
  const occupants = players.filter((p) => p.position === index); // everyone on this tile

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={[styles.modalStripe, { backgroundColor: stripe }]} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSub}>
            {labels[index]?.region ? `${labels[index]?.region} · ` : ''}
            {tile.type.replace(/_/g, ' ').toUpperCase()}
          </Text>

          <View style={styles.modalRows}>
            {tile.type === 'property' && (
              <>
                <ModalRow k="PRICE" v={`${sym}${tile.price}`} />
                {/* current rent for this tile's level — updates after each upgrade */}
                <ModalRow k="RENT" v={`${sym}${tile.rentLadder[deed?.buildings ?? 0]}`} />
                <ModalRow k="MORTGAGE" v={`${sym}${tile.mortgageValue}`} />
              </>
            )}
            {tile.type === 'utility' && (
              <>
                <ModalRow k="PRICE" v={`${sym}${tile.price}`} />
                <ModalRow k="MORTGAGE" v={`${sym}${tile.mortgageValue}`} />
              </>
            )}
            <ModalRow k="OWNER" v={owner} />
            {deed && deed.ownerId && tile.type === 'property' && <ModalRow k="LEVEL" v={String(deed.buildings)} />}
          </View>

          {occupants.length > 0 && (
            <View style={styles.hereBlock}>
              <Text style={styles.modalSub}>PLAYERS HERE</Text>
              <View style={styles.hereWrap}>
                {occupants.map((p) => (
                  <Text key={p.id} style={styles.hereItem}>
                    {playerEmoji(p.color)} {p.name || 'Player'}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <Pressable onPress={onClose} style={({ pressed }) => [styles.modalClose, pressed && styles.pressed]}>
            <Text style={styles.modalCloseText}>CLOSE</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ModalRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.modalRow}>
      <Text style={styles.modalRowK}>{k}</Text>
      <Text style={styles.modalRowV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.gutter },

  loading: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...typography.headlineLg, color: colors.onSurfaceVariant, letterSpacing: 2 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm, paddingBottom: spacing.stackSm },
  brand: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: -0.5, flex: 1 },
  roundChip: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.stackSm, paddingVertical: 4 },
  roundChipText: { ...typography.labelMd, color: colors.surface, letterSpacing: 1 },
  exitBtn: { backgroundColor: colors.secondary, ...brutal.borderThin, paddingHorizontal: spacing.stackSm, paddingVertical: 4 },
  exitText: { ...typography.labelMd, color: colors.onPrimary, letterSpacing: 1 },


  // current user's stat bar
  meBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackMd,
    paddingHorizontal: spacing.stackMd,
    paddingVertical: spacing.stackSm,
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    ...brutal.offset,
    marginBottom: spacing.stackSm,
  },
  meBarCompact: { paddingVertical: 4, marginBottom: 4 },
  swatch: { width: 24, height: 24, ...brutal.borderThin },
  swatchCompact: { width: 18, height: 18 },
  meName: { ...typography.headlineMd, color: colors.onSurface, flex: 1 },
  meNameCompact: { fontSize: 15, lineHeight: 19 },
  meCash: { ...typography.numberDisplay, color: colors.onSurface },
  meCashCompact: { fontSize: 18, lineHeight: 18 },

  // board
  boardWrap: { alignItems: 'center', paddingVertical: spacing.stackSm },
  boardWrapCompact: { paddingVertical: 3 },
  board: { width: '100%', maxWidth: 420, aspectRatio: 1, ...brutal.border, backgroundColor: colors.surfaceBright },
  boardRow: { flex: 1, flexDirection: 'row' },
  cellEmpty: { flex: 1 },
  cell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: '#fffdf8', // clean near-white tile body (vs the cream board frame)
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: '32%' },
  cellStars: { position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', fontSize: 5, lineHeight: 11, letterSpacing: -0.5, color: '#ffd23f', zIndex: 3 },
  ownerGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: '#ffffff', zIndex: 2 },
  cellLabel: { fontFamily: typography.labelMd.fontFamily, fontSize: 5, lineHeight: 5, color: colors.onSurface, textAlign: 'center', paddingHorizontal: 1, marginTop: '18%' },
  // corner tiles: full-color fill with an emoji + bold label
  cornerImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  cornerInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  cornerEmoji: { fontSize: 17, lineHeight: 20, marginBottom: 1 },
  cornerLabel: { fontFamily: typography.labelLg.fontFamily, fontSize: 8, lineHeight: 9, letterSpacing: 0.5, textAlign: 'center' },
  tokenRow: { position: 'absolute', bottom: 5, flexDirection: 'row', gap: 1, flexWrap: 'wrap', justifyContent: 'center' },
  token: { fontSize: 9, lineHeight: 11, textAlign: 'center' },
  tokenOverflow: { fontFamily: typography.labelLg.fontFamily, color: colors.onSurface, backgroundColor: '#ffffff', borderWidth: 1, borderColor: colors.outline, paddingHorizontal: 2, lineHeight: 12, textAlign: 'center', overflow: 'hidden' },
  tokenMoving: { zIndex: 5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },

  center: { position: 'absolute', top: '33%', bottom: '33%', left: '33%', right: '33%', alignItems: 'center', justifyContent: 'center' },
  centerMark: { ...typography.displayLg, color: colors.outlineVariant },

  // middle band
  band: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.stackMd, paddingVertical: spacing.stackSm },
  bandCompact: { gap: spacing.stackSm, paddingVertical: 2 },
  turnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd },
  turnText: { ...typography.headlineLg, color: colors.onSurface },
  turnTextCompact: { ...typography.headlineLgMobile },
  timerChip: { backgroundColor: colors.secondary, ...brutal.borderThin, paddingHorizontal: spacing.stackSm, paddingVertical: 2, minWidth: 56, alignItems: 'center' },
  timerChipUrgent: { backgroundColor: colors.secondary },
  timerText: { ...typography.numberDisplay, fontSize: 18, lineHeight: 20, color: colors.surface },
  timerTextUrgent: { color: colors.onPrimary },
  autoBanner: { backgroundColor: colors.secondary, ...brutal.border, paddingHorizontal: spacing.stackMd, paddingVertical: spacing.stackSm },
  autoText: { ...typography.labelLg, color: colors.onPrimary, letterSpacing: 1, textAlign: 'center' },
  diceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm },
  die: { width: 40, height: 40, backgroundColor: colors.surfaceContainerLowest, ...brutal.border, alignItems: 'center', justifyContent: 'center' },
  dieCompact: { width: 32, height: 32 },
  // reel: clip to one face and anchor the scrolling strip to the top
  dieReel: { overflow: 'hidden', justifyContent: 'flex-start' },
  dieNum: { ...typography.headlineMd, color: colors.onSurface },
  diceTotal: { ...typography.headlineMd, color: colors.onSurfaceVariant },
  roll: { backgroundColor: colors.primaryContainer, ...brutal.border, ...brutal.offset, paddingVertical: 16, paddingHorizontal: 48 },
  rollText: { ...typography.headlineMd, color: colors.onPrimaryContainer, letterSpacing: 1 },
  waitText: { ...typography.labelLg, color: colors.onSurfaceVariant, letterSpacing: 2 },

  // activity feed (height is set responsively at the call site)
  feed: {
    borderTopWidth: 4,
    borderColor: colors.outline,
    marginHorizontal: -spacing.gutter,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.stackSm,
    backgroundColor: colors.surfaceBright,
  },
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm, marginBottom: spacing.stackSm },
  feedHeadCompact: { marginBottom: 2 },
  feedHeadText: { ...typography.labelLg, color: colors.onSurface, letterSpacing: 2 },
  feedRule: { flex: 1, height: 3, backgroundColor: colors.onSurface },
  feedScroll: { flex: 1 },
  feedContent: { paddingBottom: spacing.stackSm },
  feedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.stackSm, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.outlineVariant },
  feedRowCompact: { paddingVertical: 3, gap: 6 },
  feedIconCompact: { width: 18, fontSize: 13, lineHeight: 18 },
  feedLineCompact: { fontSize: 13, lineHeight: 17 },
  feedRowNew: { backgroundColor: colors.surfaceContainerHigh, marginHorizontal: -spacing.stackSm, paddingHorizontal: spacing.stackSm },
  feedIcon: { width: 22, textAlign: 'center', fontSize: 15, lineHeight: 22, color: colors.onSurface },
  feedLine: { ...typography.bodyMd, color: colors.onSurface, flex: 1 },
  feedEmpty: { ...typography.labelMd, color: colors.onSurfaceVariant, letterSpacing: 1, paddingVertical: spacing.stackSm },

  // modal
  backdrop: { flex: 1, backgroundColor: '#1a1a1aaa', alignItems: 'center', justifyContent: 'center', padding: spacing.gutter },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceContainerLowest, ...brutal.border, ...brutal.offset, padding: spacing.stackLg, gap: spacing.stackMd },
  modalStripe: { height: 24, ...brutal.borderThin, marginBottom: spacing.stackSm },
  modalTitle: { ...typography.headlineLg, color: colors.onSurface },
  modalSub: { ...typography.labelMd, color: colors.onSurfaceVariant, letterSpacing: 1 },
  rentMsg: { ...typography.bodyLg, color: colors.onSurface },

  // money dialog — green/red tint on the card only
  moneyCardGain: { backgroundColor: '#e3f6ea', borderColor: '#147a38' },
  moneyCardLoss: { backgroundColor: '#fbe5e2', borderColor: '#b3261e' },
  moneyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm },
  moneySignText: { ...typography.numberDisplay, fontSize: 24, lineHeight: 26, color: '#ffffff' },
  moneyTitleGain: { color: '#0f5e2c' },
  moneyTitleLoss: { color: '#8c1d16' },
  moneyOkGain: { backgroundColor: '#1aa64b' },
  moneyOkLoss: { backgroundColor: colors.secondary },
  moneyOkText: { ...typography.headlineMd, color: '#ffffff', letterSpacing: 1 },
  modalRows: { gap: spacing.stackSm },
  hereBlock: { gap: spacing.stackSm, marginTop: spacing.stackSm },
  hereWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.stackSm },
  hereItem: { ...typography.bodyMd, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, ...brutal.borderThin, paddingHorizontal: spacing.stackSm, paddingVertical: 2 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderColor: colors.outlineVariant, paddingBottom: 4 },
  modalRowK: { ...typography.labelLg, color: colors.onSurfaceVariant },
  modalRowV: { ...typography.bodyLg, color: colors.onSurface },
  modalClose: { backgroundColor: colors.onSurface, alignItems: 'center', paddingVertical: 14, ...brutal.border, marginTop: spacing.stackSm },
  modalCloseText: { ...typography.headlineMd, color: colors.surface, letterSpacing: 1 },

  // turn action panel
  panel: { width: '100%', maxWidth: 420, gap: spacing.stackSm, alignItems: 'center' },
  panelLabel: { ...typography.labelLg, color: colors.onSurface, letterSpacing: 1, textAlign: 'center' },
  panelRow: { flexDirection: 'row', gap: spacing.stackSm, alignItems: 'center', justifyContent: 'center' },
  actBtn: { paddingVertical: 14, paddingHorizontal: 28, ...brutal.border, ...brutal.offset, alignItems: 'center' },
  btnYellow: { backgroundColor: colors.primaryContainer },
  btnRed: { backgroundColor: colors.secondary },
  btnBlue: { backgroundColor: colors.tertiary },
  btnLight: { backgroundColor: colors.surfaceContainerLowest },
  actText: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: 1 },
  actTextLight: { ...typography.headlineMd, color: colors.onPrimary, letterSpacing: 1 },
  stepBtn: { width: 44, height: 44, ...brutal.border, backgroundColor: colors.surfaceContainerLowest, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...typography.headlineLg, color: colors.onSurface },
  bidText: { ...typography.numberDisplay, color: colors.onSurface, minWidth: 100, textAlign: 'center' },
  mtgChip: { paddingVertical: spacing.stackSm, paddingHorizontal: spacing.stackMd, ...brutal.border, backgroundColor: colors.surfaceContainerLowest, alignItems: 'center' },
  mtgChipText: { ...typography.labelMd, color: colors.onSurface },
  mtgChipSub: { ...typography.labelMd, color: colors.onSurfaceVariant, fontSize: 9 },
  endBtn: { backgroundColor: colors.onSurface, ...brutal.border, ...brutal.offset, paddingVertical: 16, paddingHorizontal: 48 },
  endText: { ...typography.headlineMd, color: colors.surface, letterSpacing: 1 },

  // quit dialog
  quitActions: { flexDirection: 'row', gap: spacing.stackMd, marginTop: spacing.stackSm },
  quitBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, ...brutal.border, ...brutal.offset },
  quitBtnRed: { backgroundColor: colors.secondary },
  quitBtnLight: { backgroundColor: colors.surfaceContainerLowest },
  quitBtnText: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: 1 },
  quitBtnTextLight: { ...typography.headlineMd, color: colors.onPrimary, letterSpacing: 1 },

  pressed: { transform: [{ translateX: 6 }, { translateY: 6 }], shadowOffset: { width: 0, height: 0 } },
});
