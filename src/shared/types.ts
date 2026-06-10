/**
 * shared/types.ts
 * ─────────────────────────────────────────────────────────────
 * Shared RUNTIME + PROTOCOL contracts (commands, events, GameState,
 * entities, enums). Used by the server now; will be consumed by the
 * Expo client via /packages/shared once the monorepo is split.
 *
 * Static BOARD-DEFINITION types (tile layout, prices, card effects)
 * live in ../config/board.config.ts — NOT here.
 * Session/timing constants live in ../config/config.ts.
 *
 * MVP scope per TECH_SPEC.md (§4 data model, §6 protocol):
 *   • engine vocabulary is the `audit` family (not `setback`)
 *   • sealed-bid auction (not ascending)
 *   • no trade commands/events, no STATE_SYNC (Colyseus auto-syncs)
 *   • feed is structured; the client renders all display text
 *
 * Phase note: GameState/Player/Deed below are the LOGICAL contract.
 * Phase 2 implements them as @colyseus/schema classes that satisfy
 * these shapes (synced subset only; server-only fields are flagged).
 * ─────────────────────────────────────────────────────────────
 */

// ─── Primitives ───────────────────────────────────────────────
export type PlayerId = string; // = Supabase profiles.id (anonymous uuid)
export type TileIndex = number; // 0–31
export type RequestId = string; // client-supplied; server dedupes for idempotency

// 10-color palette → supports up to 10 distinct players (resolves the
// earlier >4-players open item). Beyond 10 would need auto-assign.
export type TokenColor =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "black"
  | "white"
  | "purple"
  | "orange"
  | "pink"
  | "cyan";

// ─── Enums ────────────────────────────────────────────────────
export type GamePhase =
  | "lobby"
  | "playing"
  | "auction"
  | "round_vote"
  | "game_over";
export type PlayerStatus = "active" | "bankrupt" | "spectator";
export type ConnectionStatus = "online" | "reconnecting" | "offline";
export type WinReason = "last_standing" | "net_worth_limit";
export type CardDeck = "govt_notice" | "govt_grant";
export type AuditChoice = "pay" | "card" | "wait";
export type VoteChoice = "continue" | "end";

// ─── Host-selected config knobs (MVP) ─────────────────────────
// The SET_CONFIG command payload. Defaults come from config.ts / board.config.ts.
// The live GameState (see src/state/schema.ts) flattens these onto itself.
export interface GameConfigKnobs {
  maxRounds: number | null; // null = Unlimited
  countryId: string;
  startingCash: number;
  themeId: string;
}

// NOTE: the runtime entities (GameState, Player, Deed, AuditState, SealedAuction,
// ContinueVote, PendingPurchase, PendingRaise, FeedEntry) are @colyseus/schema
// classes in src/state/schema.ts — the engine mutates those instances directly.

// ═══════════════════════════════════════════════════════════════
// PROTOCOL — Commands (client → server)
// ═══════════════════════════════════════════════════════════════
export type CommandType =
  | "JOIN"
  | "REJOIN"
  | "LEAVE"
  | "SET_CONFIG"
  | "SET_COLOR"
  | "START_GAME"
  | "ROLL"
  | "BUY"
  | "PASS"
  | "BID"
  | "FOLD"
  | "BUILD"
  | "SELL_BUILDING"
  | "MORTGAGE"
  | "UNMORTGAGE"
  | "RAISE_FUNDS_DONE"
  | "DECLARE_BANKRUPTCY"
  | "RESOLVE_AUDIT"
  | "END_TURN"
  | "VOTE_CONTINUE";

export interface CommandPayloads {
  JOIN: { code: string; name: string };
  REJOIN: { code: string; playerId: PlayerId; reconnectToken: string };
  LEAVE: undefined;
  SET_CONFIG: GameConfigKnobs;
  SET_COLOR: { color: TokenColor };
  START_GAME: undefined;
  ROLL: undefined;
  BUY: { tileIndex: TileIndex };
  PASS: { tileIndex: TileIndex };
  BID: { amount: number };
  FOLD: undefined;
  BUILD: { tileIndex: TileIndex };
  SELL_BUILDING: { tileIndex: TileIndex };
  MORTGAGE: { tileIndex: TileIndex };
  UNMORTGAGE: { tileIndex: TileIndex };
  RAISE_FUNDS_DONE: undefined;
  DECLARE_BANKRUPTCY: undefined;
  RESOLVE_AUDIT: { choice: AuditChoice };
  END_TURN: undefined;
  VOTE_CONTINUE: { choice: VoteChoice };
}

// Wire envelope for a command of a given type.
export type Command<T extends CommandType = CommandType> = {
  type: T;
  requestId: RequestId;
  payload: CommandPayloads[T];
};

// ═══════════════════════════════════════════════════════════════
// PROTOCOL — Events (server → client, broadcast)
// Ephemeral notifications for toasts/animation/feed; durable truth
// is the synced @colyseus/schema state.
// ═══════════════════════════════════════════════════════════════
export type EventType =
  | "ROOM_UPDATED"
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "PLAYER_PRESENCE"
  | "GAME_STARTED"
  | "ROLL_RESULT"
  | "MOVE"
  | "SALARY_PAID"
  | "PURCHASE"
  | "AUCTION_STARTED"
  | "AUCTION_BID"
  | "AUCTION_WON"
  | "RENT_CHARGED"
  | "TAX_PAID"
  | "CARD_DRAWN"
  | "AUDIT_APPLIED"
  | "AUDIT_RESOLVED"
  | "BUILD_CHANGED"
  | "MORTGAGE_CHANGED"
  | "RAISE_FUNDS_REQUIRED"
  | "BANKRUPTCY"
  | "TURN_CHANGED"
  | "ROUND_COMPLETED"
  | "ROUND_LIMIT_REACHED"
  | "VOTE_STARTED"
  | "VOTE_UPDATED"
  | "VOTE_RESULT"
  | "GAME_OVER"
  | "ERROR";

export interface StandingRow {
  playerId: PlayerId;
  name: string;
  netWorth: number;
  status: PlayerStatus;
  rank: number;
}

export interface EventPayloads {
  ROOM_UPDATED: Record<string, never>;
  PLAYER_JOINED: { playerId: PlayerId; name: string };
  PLAYER_LEFT: { playerId: PlayerId };
  PLAYER_PRESENCE: { playerId: PlayerId; connection: ConnectionStatus };
  GAME_STARTED: { turnOrder: PlayerId[] };
  ROLL_RESULT: {
    playerId: PlayerId;
    die1: number;
    die2: number;
    total: number;
    isDoubles: boolean;
    doublesCount: number;
  };
  MOVE: { playerId: PlayerId; path: TileIndex[]; passedStart: boolean };
  SALARY_PAID: { playerId: PlayerId; amount: number };
  PURCHASE: { playerId: PlayerId; tileIndex: TileIndex; price: number };
  AUCTION_STARTED: {
    tileIndex: TileIndex;
    endsAt: number;
    eligibleIds: PlayerId[];
  };
  AUCTION_BID: { playerId: PlayerId }; // submission only — NO amount
  AUCTION_WON: {
    winnerId: PlayerId | null;
    amount: number;
    tie: boolean;
    allBids: { playerId: PlayerId; amount: number }[];
  };
  RENT_CHARGED: {
    payerId: PlayerId;
    receiverId: PlayerId;
    tileIndex: TileIndex;
    amount: number;
  };
  TAX_PAID: { playerId: PlayerId; tileIndex: TileIndex; amount: number };
  CARD_DRAWN: { playerId: PlayerId; deck: CardDeck; cardId: string };
  AUDIT_APPLIED: { playerId: PlayerId; turns: number };
  AUDIT_RESOLVED: {
    playerId: PlayerId;
    method: AuditChoice | "doubles" | "auto";
  };
  BUILD_CHANGED: {
    playerId: PlayerId;
    tileIndex: TileIndex;
    buildings: number;
  };
  MORTGAGE_CHANGED: {
    playerId: PlayerId;
    tileIndex: TileIndex;
    mortgaged: boolean;
  };
  RAISE_FUNDS_REQUIRED: {
    playerId: PlayerId;
    amount: number;
    creditorId: PlayerId | null;
  };
  BANKRUPTCY: { playerId: PlayerId; creditorId: PlayerId | null };
  TURN_CHANGED: { playerId: PlayerId; turnEndsAt: number };
  ROUND_COMPLETED: { round: number };
  ROUND_LIMIT_REACHED: { round: number };
  VOTE_STARTED: { endsAt: number };
  VOTE_UPDATED: { votes: Record<PlayerId, VoteChoice> };
  VOTE_RESULT: { outcome: VoteChoice };
  GAME_OVER: {
    winnerId: PlayerId | null;
    reason: WinReason;
    standings: StandingRow[];
    tiebreak?: string;
  };
  ERROR: { code: ErrorCode; requestId?: RequestId };
}

export type GameEvent<T extends EventType = EventType> = {
  type: T;
  payload: EventPayloads[T];
};

// ─── Typed error codes (ERROR event) ──────────────────────────
export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ALREADY_STARTED"
  | "ROOM_FULL"
  | "NOT_HOST"
  | "TOO_FEW_PLAYERS"
  | "COLOR_TAKEN"
  | "NOT_YOUR_TURN"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_TILE"
  | "NOT_OWNER"
  | "ILLEGAL_ACTION"
  | "BAD_REQUEST";
