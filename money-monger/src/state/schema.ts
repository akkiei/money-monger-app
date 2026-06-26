/**
 * state/schema.ts
 * The canonical GameState as @colyseus/schema classes (TECH_SPEC §4.1,
 * approach A). Colyseus auto-syncs every @type-decorated field as deltas to
 * clients. Fields WITHOUT @type are server-only (never synced) but still live
 * on the instance — they are captured in JSON snapshots.
 *
 * Sentinels (schema-safe; avoids null in synced fields):
 *   Deed.ownerId === ''        → owned by the bank / unowned
 *   PendingRaise.creditorId === '' → owed to the bank
 *   GameState.maxRounds === -1 → Unlimited
 *
 * The engine (src/engine/*) mutates these instances directly.
 */
import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';
import type {
  ConnectionStatus,
  EventType,
  GamePhase,
  PlayerStatus,
} from '../shared/types';

export class AuditState extends Schema {
  @type('number') turnsLeft = 0;
  @type('number') doubleAttempts = 0;
}

export class Player extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') color = ''; // '' until picked in the waiting room
  @type('boolean') isAI = false;
  @type('boolean') isHost = false;
  @type('number') cash = 0;
  @type('number') position = 0;
  @type('string') status: PlayerStatus = 'active';
  @type('string') connection: ConnectionStatus = 'online';
  @type('number') clearanceCards = 0;
  @type('boolean') pendingDiscount = false;
  @type(AuditState) audit?: AuditState;
}

export class Deed extends Schema {
  @type('number') tileIndex = 0;
  @type('string') ownerId = ''; // '' = bank
  @type('number') buildings = 0; // 0–4 (4 = HQ)
  @type('boolean') mortgaged = false;
}

export class SealedAuction extends Schema {
  @type('number') tileIndex = 0;
  @type('number') endsAt = 0;
  @type(['string']) eligibleIds = new ArraySchema<string>();
  @type(['string']) submittedIds = new ArraySchema<string>(); // status only; amounts are server-only
}

export class ContinueVote extends Schema {
  @type('number') endsAt = 0;
  @type({ map: 'string' }) votes = new MapSchema<string>(); // playerId -> 'continue' | 'end'
}

export class PendingPurchase extends Schema {
  @type('number') tileIndex = 0;
  @type('string') playerId = '';
}

export class PendingRaise extends Schema {
  @type('string') playerId = '';
  @type('number') amount = 0;
  @type('string') creditorId = ''; // '' = bank
}

export class FeedEntry extends Schema {
  @type('string') type: EventType = 'ROOM_UPDATED';
  @type('number') ts = 0;
  @type('string') actorId = '';
  @type('string') targetId = '';
  @type('number') amount = 0;
  @type('number') tileIndex = -1;
}

export class GameState extends Schema {
  // identity / setup (locked at start)
  @type('string') code = '';
  @type('string') themeId = '';
  @type('string') countryId = '';
  @type('number') startingCash = 0;
  @type('number') maxRounds = -1; // -1 = Unlimited

  // phase / turn
  @type('string') phase: GamePhase = 'lobby';
  @type('number') round = 0;
  @type(['string']) turnOrder = new ArraySchema<string>();
  @type('number') turnIndex = 0;
  @type('string') roundAnchor = '';
  @type('number') turnEndsAt = 0;

  // entities
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Deed }) deeds = new MapSchema<Deed>();

  // shared feed (bounded last-N) + pending sub-states
  @type([FeedEntry]) feed = new ArraySchema<FeedEntry>();
  @type(SealedAuction) pendingAuction?: SealedAuction;
  @type(ContinueVote) pendingVote?: ContinueVote;
  @type(PendingPurchase) pendingPurchase?: PendingPurchase;
  @type(PendingRaise) pendingRaise?: PendingRaise;

  // turn-flow flags the client needs to choose the next action (roll vs end turn)
  @type('boolean') awaitingRoll = false;
  @type('boolean') rollAgain = false;

  // ── server-only (NOT @type → never synced; captured in JSON snapshots) ──
  rngSeed = '';
  rngCursor = 0;
  decks: { govt_notice: string[]; govt_grant: string[] } = {
    govt_notice: [],
    govt_grant: [],
  };
  turnDoubles = 0;
  extraTurnPending = false;
  pendingDistribution?: { recipients: string[]; amount: number };
  auctionBids?: Record<string, number>;
}
