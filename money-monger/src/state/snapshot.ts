/**
 * state/snapshot.ts — converts the live @colyseus/schema GameState into a plain,
 * immutable JS object the React screens consume. Screens never touch MapSchema /
 * ArraySchema directly; the session controller rebuilds a snapshot on every
 * room.onStateChange and pushes it into the store.
 */
import type { ConnectionStatus, GamePhase, PlayerStatus } from '../shared/types';
import type { Deed, GameState, Player } from './schema';

export type PlayerSnap = {
  id: string;
  name: string;
  color: string;
  isAI: boolean;
  isHost: boolean;
  cash: number;
  position: number;
  status: PlayerStatus;
  connection: ConnectionStatus;
  clearanceCards: number;
  auditTurnsLeft: number;
};

export type DeedSnap = { tileIndex: number; ownerId: string; buildings: number; mortgaged: boolean };

export type PendingPurchaseSnap = { tileIndex: number; playerId: string };
export type AuctionSnap = { tileIndex: number; endsAt: number; eligibleIds: string[]; submittedIds: string[] };
export type RaiseSnap = { playerId: string; amount: number; creditorId: string };
export type VoteSnap = { endsAt: number; votes: Record<string, string> };

export type GameSnapshot = {
  code: string;
  phase: GamePhase;
  round: number;
  maxRounds: number;
  countryId: string;
  startingCash: number;
  themeId: string;
  turnOrder: string[];
  turnIndex: number;
  turnEndsAt: number;
  awaitingRoll: boolean;
  players: PlayerSnap[];
  deeds: Record<number, DeedSnap>;
  pendingPurchase: PendingPurchaseSnap | null;
  pendingAuction: AuctionSnap | null;
  pendingRaise: RaiseSnap | null;
  pendingVote: VoteSnap | null;
};

export function toSnapshot(s: GameState): GameSnapshot {
  // Collections can be momentarily undefined before the first full decode, so
  // every access here is null-safe — a partial snapshot fills in as state syncs.
  const players: PlayerSnap[] = [];
  s.players?.forEach((p: Player) =>
    players.push({
      id: p.id,
      name: p.name,
      color: p.color,
      isAI: p.isAI,
      isHost: p.isHost,
      cash: p.cash,
      position: p.position,
      status: p.status,
      connection: p.connection,
      clearanceCards: p.clearanceCards,
      auditTurnsLeft: p.audit?.turnsLeft ?? 0,
    }),
  );

  const deeds: Record<number, DeedSnap> = {};
  s.deeds?.forEach((d: Deed) => {
    deeds[d.tileIndex] = { tileIndex: d.tileIndex, ownerId: d.ownerId, buildings: d.buildings, mortgaged: d.mortgaged };
  });

  const votes: Record<string, string> = {};
  s.pendingVote?.votes?.forEach((v: string, k: string) => {
    votes[k] = v;
  });

  return {
    code: s.code ?? '',
    phase: s.phase ?? 'lobby',
    round: s.round ?? 0,
    maxRounds: s.maxRounds ?? -1,
    countryId: s.countryId ?? 'india',
    startingCash: s.startingCash ?? 0,
    themeId: s.themeId ?? 'default',
    turnOrder: s.turnOrder ? [...s.turnOrder] : [],
    turnIndex: s.turnIndex ?? 0,
    turnEndsAt: s.turnEndsAt ?? 0,
    awaitingRoll: s.awaitingRoll ?? false,
    players,
    deeds,
    // NOTE: this @colyseus/schema build pre-instantiates optional child schemas
    // as empty objects (not undefined) on the client, so a bare truthiness check
    // is always true. Treat a pending sub-state as REAL only when it carries data
    // (a live vote/auction has endsAt > 0; a real purchase/raise has a playerId).
    pendingPurchase:
      s.pendingPurchase && s.pendingPurchase.playerId
        ? { tileIndex: s.pendingPurchase.tileIndex, playerId: s.pendingPurchase.playerId }
        : null,
    pendingAuction:
      s.pendingAuction && s.pendingAuction.endsAt > 0
        ? {
            tileIndex: s.pendingAuction.tileIndex,
            endsAt: s.pendingAuction.endsAt,
            eligibleIds: s.pendingAuction.eligibleIds ? [...s.pendingAuction.eligibleIds] : [],
            submittedIds: s.pendingAuction.submittedIds ? [...s.pendingAuction.submittedIds] : [],
          }
        : null,
    pendingRaise:
      s.pendingRaise && s.pendingRaise.playerId
        ? { playerId: s.pendingRaise.playerId, amount: s.pendingRaise.amount, creditorId: s.pendingRaise.creditorId }
        : null,
    pendingVote: s.pendingVote && s.pendingVote.endsAt > 0 ? { endsAt: s.pendingVote.endsAt, votes } : null,
  };
}

/** The player whose turn it is (turnOrder[turnIndex]), or null in lobby. */
export function activeId(s: GameSnapshot): string | null {
  return s.turnOrder[s.turnIndex] ?? null;
}

/**
 * True once the game has actually started (a board-bearing phase). Used to
 * decide when to navigate to the board — a positive check so an unsynced/empty
 * phase ('' / undefined right after connect) never counts as "in progress".
 */
export function isInProgress(phase: GamePhase | undefined): boolean {
  return phase === 'playing' || phase === 'auction' || phase === 'round_vote';
}
