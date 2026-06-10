# Board Game — MVP Technical Specification

**Status:** Development source of truth (derived from `PROJECT.md` + `stitch-doc.md` + the screen-by-screen planning pass).
**Scope:** This document defines the **MVP** build. Where it conflicts with `PROJECT.md`, **this document wins** (PROJECT.md remains the long-term vision).
**Stack:** TypeScript · Node + Colyseus 0.15 (this repo, authoritative server) · React Native + Expo (client, separate) · Supabase (Postgres + anon Auth) · Azure (VM host + Blob storage for themes).
**Last updated:** 2026-06-01.

> Read order for a new developer: §1 (scope) → §2 (architecture) → §4 (data model) → §6 (protocol) → §7 (rules) → §9 (build plan).

---

## Table of contents

1. Product scope (MVP) — what's in, what's out
2. Architecture & key decisions
3. Configuration reference (the three layers + constants)
4. Data model — in-memory `GameState` (Colyseus Schema) + Supabase DB
5. Identity, sessions & reconnection
6. Realtime protocol — commands & events
7. Game rules (engine specification)
8. Screen-by-screen reference (UI ↔ data ↔ commands ↔ events)
9. End-to-end development plan
10. Reconciliation tasks (stale code to fix)
11. Deferred / post-MVP backlog
12. Open items still to decide

---

## 1. Product scope (MVP)

An original, Monopoly-inspired property-trading game. **Multiplayer only**, 2+ players, online via room code. Original names/art/mechanics for legal safety (no Monopoly terms hardcoded — all on-board strings come from themes).

**Five hard principles (unchanged from PROJECT.md):**
1. **Authoritative backend** — the server decides, the client renders. No rules in client or DB.
2. **Fixed engine, cosmetic themes** — one rules engine; themes change only labels/art.
3. **Automated CPU Banker** — the only writer to the ledger; every transaction is atomic.
4. **No login** — silent device-bound anonymous Supabase session + a per-game reconnect token.
5. **Round-limited matches** — a round = every active player took one turn; at the limit, a majority continue-vote.

### In scope (MVP)

- Two-entry landing: **Start Game** (create/host) and **Join Game** (enter code).
- Host lobby with **live join status** and host-selected options: **rounds, country, starting cash, theme**.
- Full turn loop: roll → move → buy/pass → **sealed-bid auction** → rent/tax/card → **audit** (jail replacement) → build/mortgage on own turn → raise-funds/bankruptcy.
- **Continue-vote** at the round limit; standings; win by last-standing or net worth; tiebreakers.
- Reconnection (blip / app-close / server-restart) + grace.
- **Match-standings history** persisted on game over.
- Themes delivered as config files from **Azure Blob**, downloaded by the client.

### Out of scope (MVP) — see §11

- **Solo / all-AI mode**, local pass-and-play.
- **Trade** (the only async/two-party feature) — first post-MVP feature.
- **Leaderboard** (waits for real login/signup), Shop, Friends/social, invites, persistent coin wallet.
- Spectators (non-member late join is hard-rejected).
- Replay reconstruction, How-to-Play screen, host-configurable rule toggles.

---

## 2. Architecture & key decisions

```
 React Native + Expo client  ──WS (colyseus.js)──►  Colyseus GameRoom (authoritative)
   • renders synced state                              • single-writer command loop
   • plays animations                                  • Banker mutates state atomically
   • downloads theme.json from Azure Blob              • broadcasts ephemeral events
   • holds board.config + countries (bundled)          • snapshots GameState → Supabase
        │                                                        │
        └── anon auth (supabase-js) ──► Supabase  ◄── service-role writes (server only)
                                         Postgres: profiles, rooms, room_players,
                                                   game_snapshots, matches
        Azure Blob ──► theme.json + assets (+ theme manifest)
```

### 2.1 State sync = HYBRID (Colyseus Schema + broadcast events) — **decided**

- The canonical `GameState` is modeled as **`@colyseus/schema`** classes. Colyseus auto-syncs **deltas** to all clients and **handles reconnection resync automatically** — there is **no hand-rolled `STATE_SYNC` / version / requestId-reducer**.
- **Ephemeral "events"** (`ROLL_RESULT`, `MOVE` path, `RENT_CHARGED`, …) are sent with `this.broadcast(type, payload)` purely to drive **toasts / animations / feed**. They are **not** state.
- Rule of thumb: *if a reconnecting client needs it, it's schema state; if it's a one-time notification, it's a broadcast event.*

### 2.2 Hidden-state pattern — **decided**

Secret info (sealed auction bids; any future hidden info) is **never** in synced schema. It lives in **plain server-only room memory**; schema syncs only non-secret status (e.g. `submittedIds`); the secret is revealed via a **broadcast message** at the reveal moment. Leak-proof by construction.

### 2.3 Feed / notifications are STRUCTURED — **decided**

The server emits **only ids / tile indices / amounts** — never human-readable strings. The synced `feed` is a bounded list of **structured `FeedEntry`** objects; the **client composes all display text** from theme + country + board config. Dual rent notification = one `RENT_CHARGED` broadcast; the client picks coral "you paid" / gold "you received" / neutral-feed by comparing to its own `playerId`.

### 2.4 Three config layers — **decided** (see §3)

| Layer | Owns | Where it lives | Who reads it |
|---|---|---|---|
| **Board config** | tile layout, prices, rent ladders, tax math, card *effects*, audit/salary/auction mechanics | `src/config/board.config.ts` (bundled) | engine + client |
| **Country data** | district/region names, city/property names, currency | `src/config/countries.json` → loaded into state at start | client (display); server bakes city names into board at start |
| **Theme** | display **labels**, palette, art, sounds, card *flavor text* | `theme.json` in **Azure Blob**, downloaded by client | **client only** (server stores `themeId`) |

The engine references **stable neutral keys** only (`audit`, `card_govt_notice`, …); the theme maps each key → a display label. Theme handling is therefore **almost entirely client-side**; the server just validates `themeId` and locks it into state.

### 2.5 Naming — **decided** (= "keep board-config keys")

Engine vocabulary follows `board.config.ts`: tile types `start | audit | rest_stop | go_to_audit | property | utility | tax | card_govt_notice | card_govt_grant`; card decks `govt_notice | govt_grant`. These are opaque keys; themes relabel them. The stale `src/shared/types.ts` / `src/shared/config.ts` must be reconciled to this (see §10).

### 2.6 Command processing = single-writer, serial

All commands for a room are processed **serially** (Colyseus message handlers run one at a time per room). With **trade deferred, there is no async/anytime action** — every command is on-turn or a forced response (bid/vote/raise-funds). `requestId` is kept on commands for idempotency.

---

## 3. Configuration reference

### 3.1 `src/config/config.ts` — session/timing constants (`GAME_CONFIG`)

| Constant | Default | Notes |
|---|---|---|
| `STARTING_CASH` | 1500 | **host-overridable** |
| `DEFAULT_MAX_ROUNDS` | 20 | host picks 10/20/30/Unlimited |
| `CONTINUE_INCREMENT_N` | 10 | rounds added if continue-vote passes |
| `VOTE_DURATION_S` | 15 | continue-vote countdown |
| `TURN_TIMEOUT_S` | 30 | Banker auto-plays on timeout |
| `MAX_DOUBLES_IN_A_ROW` | 3 | 3rd double → audit |
| `UNMORTGAGE_INTEREST_RATE` | 0.10 | |
| `DISCONNECT_GRACE_S` | 120 | seat held before AI takeover |
| `AI_TAKEOVER_AFTER_ROUNDS` | 2 | |
| `ROOM_CODE_LENGTH` | **4** | ⚠ currently `6` in code — change to 4 (§10) |
| `MIN_PLAYERS_TO_START` | 2 | incl. host |
| `SNAPSHOT_EVERY_N_TURNS` | 1 | also on phase change |

### 3.2 `src/config/board.config.ts` — board/engine source of truth

- **32 tiles**, 9×9 perimeter. Corners: `0 start`, `8 rest_stop`, `16 go_to_audit`, `24 audit`.
- **5 districts** (scattered): d1 `[1,5,7]` build 50 · d2 `[3,11,15]` build 100 · d3 `[9,13,19,23]` build 150 · d4 `[17,21,27,30]` build 200 · d5 `[25,28,29,31]` build 200. All `sellRefund 0.5`, `monopolyRentMultiplier 2`.
- **Utilities:** u1 `idx6`, u2 `idx12`, price 150. Rent = `dice × (ownOne 4 | ownBoth 10)`.
- **Tax:** `idx4` fixed 200; `idx20` percentage of cash 0.10.
- **Card tiles:** notice `10,18,26`; grant `2,14,22`.
- **Mechanic blocks:** `auditRules {turns:3, settleCost:100, maxDoubleAttempts:3}`, `salary {amount:200, doubleSalaryMultiplier:2}`, `auctionConfig {bidTimerSeconds:30, minimumBid:'property_price'}`.
- **Card decks** (effect logic; theme supplies flavor): see §7.9.

### 3.3 Host-selectable knobs (MVP) — **decided**

Only **four**: `maxRounds`, `countryId`, `startingCash`, `themeId`. Everything else (rule toggles, salary, turn timer, max players) stays a **fixed default** from config. **Defaults→overrides model:** the engine reads `effective = hostOverride ?? configDefault`. These four live in `rooms.config` (jsonb) and the in-memory config.

### 3.4 Countries (`countries.json`)

India (default), USA, UK. Each: `{id, name, flag, isDefault, currency, regions[]}`; each region `{id, name, tier(1–5), cities[{tileIndex, name}]}`. `tier N → district dN` is the bridge to board.config. Read **once at game start**; city names baked into the board in `GameState`. Never mutated mid-game.

---

## 4. Data model

### 4.1 In-memory `GameState` — `@colyseus/schema` (synced to clients)

> Modeled with `Schema` / `MapSchema` / `ArraySchema` + `@type`. **Synced = dynamic only.** Static board (indices/prices/types), city names, and theme labels are config the client already holds and are **not** synced (city names are sent once in `GameStarted`/initial state for clients that didn't bundle them, or bundled — see §8 board screen).

```ts
class GameState extends Schema {
  // identity / setup (locked at start)
  @type("string") code: string;            // 4-char join code
  @type("string") themeId: string;
  @type("string") countryId: string;
  @type("number") startingCash: number;    // effective (host override or default)
  @type("number") maxRounds: number;       // 0 / -1 sentinel for "Unlimited" (null not schema-friendly)

  // phase / turn
  @type("string") phase: GamePhase;        // 'lobby'|'playing'|'auction'|'round_vote'|'game_over'
  @type("number") round: number;
  @type(["string"]) turnOrder: ArraySchema<string>;  // playerIds
  @type("number") turnIndex: number;
  @type("string") roundAnchor: string;     // playerId who started the round
  @type("number") turnEndsAt: number;      // epoch ms; drives the turn-timer ring

  // entities
  @type({ map: Player }) players: MapSchema<Player>;   // keyed by playerId
  @type({ map: Deed })   deeds:   MapSchema<Deed>;     // keyed by tileId (= index as string)

  // shared feed (bounded — last N structured entries)
  @type([FeedEntry]) feed: ArraySchema<FeedEntry>;

  // pending sub-states (only one active at a time, by phase)
  @type(Auction)      pendingAuction:  Auction;       // present in 'auction' phase
  @type(ContinueVote) pendingVote:     ContinueVote;   // present in 'round_vote' phase
  @type(PendingPurchase) pendingPurchase: PendingPurchase; // active player deciding buy/pass
  @type(PendingRaise)    pendingRaise:    PendingRaise;    // active player covering a debt
}
```

```ts
class Player extends Schema {
  @type("string") id: string;             // = profiles.id (anon auth uuid)
  @type("string") name: string;           // per-seat name (entered on join)
  @type("string") color: string;          // token color id (may be '' until picked)
  @type("boolean") isAI: boolean;
  @type("number") cash: number;
  @type("number") position: number;       // tile index 0–31
  @type("string") status: string;         // 'active'|'bankrupt'|'spectator'
  @type("string") connection: string;     // 'online'|'reconnecting'|'offline'
  @type("number") clearanceCards: number; // held Audit Clearance Cards (a count; not secret)
  @type("boolean") pendingDiscount: boolean; // one-time 50% next purchase (PROPERTY_DISCOUNT)
  @type(AuditState) audit: AuditState;     // present only while under audit
  @type("boolean") isHost: boolean;
}

class AuditState extends Schema {
  @type("number") turnsLeft: number;
  @type("number") doubleAttempts: number;
}

class Deed extends Schema {
  @type("string") tileId: string;          // = index as string
  @type("string") ownerId: string;         // '' = bank
  @type("number") buildings: number;       // 0–4 (4 = HQ)
  @type("boolean") mortgaged: boolean;
}

class FeedEntry extends Schema {
  @type("string") type: string;            // event type key
  @type("string") actorId: string;
  @type("string") targetId: string;        // '' if none
  @type("number") amount: number;          // 0 if none
  @type("number") tileIndex: number;       // -1 if none
  @type("number") ts: number;
}

class Auction extends Schema {            // sealed-bid (NOT ascending)
  @type("number") tileIndex: number;
  @type("number") endsAt: number;
  @type(["string"]) eligibleIds: ArraySchema<string>;
  @type(["string"]) submittedIds: ArraySchema<string>;  // who has bid (NOT amounts)
  // bid AMOUNTS are NOT here — server-only Map<playerId, number>; revealed via AUCTION_WON
}

class ContinueVote extends Schema {
  @type("number") endsAt: number;
  @type({ map: "string" }) votes: MapSchema<string>;     // playerId -> 'continue'|'end' (public)
}

class PendingPurchase extends Schema {
  @type("number") tileIndex: number;
  @type("string") playerId: string;
}

class PendingRaise extends Schema {
  @type("string") playerId: string;
  @type("number") amount: number;          // total owed
  @type("string") creditorId: string;      // '' = owed to bank
}
```

**Server-only (NOT synced, included in snapshots):**
- `rngSeed: string`, `rngCursor: number` — deterministic dice/shuffles (seeded PRNG).
- `auctionBids: Map<playerId, number>` — sealed bids (revealed via broadcast).
- `decks: { govt_notice: cardId[]; govt_grant: cardId[] }` — shuffled deck order + draw cursor.
- `doublesCount` (per active turn), pending timers.

### 4.2 Supabase (Postgres) — MVP tables

> Only **5 tables** (no `leaderboard` until login/signup). All game mutations go through the server with the **service-role key**; clients use the anon key for reads only.

```sql
-- Anonymous-first identity. Maps to Supabase auth.users.id.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  avatar text,
  is_guest boolean not null default true,
  created_at timestamptz not null default now()
);

-- Room / lobby / match container.
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 4-char A–Z/2–9 (no 0/O/1/I/L)
  host_id uuid references profiles(id),
  theme_id text not null,
  country_id text not null,
  status text not null default 'lobby',      -- lobby|playing|finished|abandoned
  config jsonb not null,                     -- { maxRounds, countryId, startingCash, themeId }
  server_instance text,                      -- which game-server owns it
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on rooms (code);

-- A seat in a room. reconnect_token is the secret used to reclaim a seat.
create table room_players (
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references profiles(id),
  seat int not null,                         -- arbitrary N (no 4-cap)
  name text not null,                        -- per-game display name (entered on join)
  color text,                                -- chosen in waiting room; null until picked
  is_ai boolean not null default false,
  reconnect_token text not null,             -- secret, server-generated
  status text not null default 'active',     -- active|reconnecting|bankrupt|spectator|left
  primary key (room_id, player_id),
  unique (room_id, color)                    -- token color unique within a room
);

-- Authoritative snapshots for crash recovery + reconnection.
create table game_snapshots (
  room_id uuid references rooms(id) on delete cascade,
  version bigint not null,
  state jsonb not null,                       -- full GameState incl. rngSeed/cursor, decks
  created_at timestamptz not null default now(),
  primary key (room_id, version)
);

-- Completed-match standings history (no leaderboard yet).
create table matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id),
  theme_id text,
  country_id text,
  rounds_played int,
  win_reason text,                            -- 'last_standing' | 'net_worth_limit'
  winner_id uuid references profiles(id),
  standings jsonb not null,                   -- ranked [{playerId, name, netWorth, status, rank}]
  duration_seconds int,
  created_at timestamptz not null default now()
  -- event_log + rng_seed (replay) deferred to post-MVP
);
```

**RLS:**
- `profiles` — read/update own row only.
- `rooms` / `room_players` — readable by room members; **writes server-only** (service-role).
- `game_snapshots` — server-only write; read by members if needed (usually via server).
- `matches` — public read; server-only write.

### 4.3 Persistence rhythm

Snapshot full `GameState` (incl. server-only rng/decks) to `game_snapshots` every turn (`SNAPSHOT_EVERY_N_TURNS`) and on phase changes. On server restart, rehydrate the latest snapshot; `reconnect_token` in `room_players` keeps clients valid. On `game_over`: write `matches`, set `rooms.status='finished'` + `finished_at`, hold the room briefly for the results screen, then dispose.

---

## 5. Identity, sessions & reconnection

- **Device identity:** on first launch the client does Supabase **anonymous sign-in** → stable `auth.users.id` = `profiles.id` (auto-created row). No email/password.
- **Per-game reconnect token:** on `JOIN`/create, the server generates a secret `reconnectToken`, stores it in `room_players`, and returns it. The client persists the **active-game pointer** `{ roomCode, playerId, reconnectToken }` in `expo-secure-store`.
- **Reconnection flows:** (a) blip — Colyseus auto-reconnect + `REJOIN`; (b) app relaunch — read pointer → "Rejoin your game?" → `REJOIN`; (c) server restart — rehydrate snapshot, same token works. Colyseus pushes full state automatically on (re)join (no manual `STATE_SYNC`).
- **Grace & takeover:** on disconnect mark `reconnecting`, hold the seat; Banker auto-plays safe defaults on their turn (roll, decline purchase → auction, wait-out audit, end turn). After `AI_TAKEOVER_AFTER_ROUNDS` missed rounds the seat converts to **AI**; a returning human reclaims via `REJOIN`.
- **Edge cases:** one socket per player (kick duplicate); rejoin after bankruptcy → spectator; finished room → results screen; <2 active players → last player wins.

---

## 6. Realtime protocol

Transport: the Colyseus room WebSocket (`colyseus.js`). Lobby presence rides **Colyseus schema state**, not Supabase Realtime (Realtime is out of MVP).

### 6.1 Commands (client → server) — MVP set

Each carries `{ requestId }` for idempotency.

| Command | Payload | Guard |
|---|---|---|
| `JOIN` | `{ code, name }` | room exists, lobby, not full (via Colyseus `joinByCode`) |
| `REJOIN` | `{ code, playerId, reconnectToken }` | token valid + anon JWT |
| `LEAVE` | — | any member |
| `SET_CONFIG` | `{ maxRounds, countryId, startingCash, themeId }` | host only, lobby |
| `SET_COLOR` | `{ color }` | member, lobby, color free in room |
| `START_GAME` | — | host only, ≥2 seats |
| `ROLL` | — | active player, playing (or under-audit roll attempt) |
| `BUY` / `PASS` | `{ tileIndex }` | active player, on unowned tile, `pendingPurchase` |
| `BID` / `FOLD` | `{ amount? }` | auction phase, eligible, price ≤ amount ≤ cash |
| `BUILD` / `SELL_BUILDING` | `{ tileIndex }` | owner, **own turn**, district + even-build rules, funds/supply |
| `MORTGAGE` / `UNMORTGAGE` | `{ tileIndex }` | owner, **own turn** (or forced during raise-funds) |
| `RAISE_FUNDS_DONE` / `DECLARE_BANKRUPTCY` | — | player in `pendingRaise` |
| `RESOLVE_AUDIT` | `{ choice: 'pay'|'card'|'wait' }` | player under audit, their turn |
| `END_TURN` | — | active player |
| `VOTE_CONTINUE` | `{ choice: 'continue'|'end' }` | round_vote phase, active player |

*Dropped from PROJECT.md for MVP: `PROPOSE_TRADE`, `RESPOND_TRADE` (trade deferred). `RESOLVE_SETBACK` → renamed `RESOLVE_AUDIT`. New: `SET_COLOR`.*

### 6.2 Events (server → client, broadcast) — MVP set

These are ephemeral (toasts/animation/feed); durable truth is in synced schema state.

`ROOM_UPDATED` · `PLAYER_JOINED` · `PLAYER_LEFT` · `PLAYER_PRESENCE` · `GAME_STARTED` · `ROLL_RESULT` · `MOVE` · `SALARY_PAID` · `PURCHASE` · `AUCTION_STARTED` · `AUCTION_BID` · `AUCTION_WON` · `RENT_CHARGED` · `TAX_PAID` · `CARD_DRAWN` · `AUDIT_APPLIED` · `AUDIT_RESOLVED` · `BUILD_CHANGED` · `MORTGAGE_CHANGED` · `RAISE_FUNDS_REQUIRED` · `BANKRUPTCY` · `TURN_CHANGED` · `ROUND_COMPLETED` · `ROUND_LIMIT_REACHED` · `VOTE_STARTED` · `VOTE_UPDATED` · `VOTE_RESULT` · `GAME_OVER` · `ERROR`.

*Dropped: `STATE_SYNC` (Colyseus auto-syncs), `TRADE_*`. Renamed: `SETBACK_*` → `AUDIT_*`.*

**Key payloads:**
```ts
ROLL_RESULT  { playerId, die1, die2, total, isDoubles, doublesCount }
MOVE         { playerId, path: number[], passedStart }
RENT_CHARGED { payerId, receiverId, tileIndex, amount }   // drives BOTH toasts client-side
AUCTION_STARTED { tileIndex, endsAt, eligibleIds }
AUCTION_BID  { playerId }                                 // submission only, NO amount
AUCTION_WON  { winnerId, amount, tie, allBids: {playerId, amount}[] }  // reveal
AUDIT_APPLIED  { playerId, turns }
RAISE_FUNDS_REQUIRED { playerId, amount, creditorId }
GAME_OVER    { winnerId, reason, standings, tiebreak? }
ERROR        { code, requestId? }                         // typed code set (see §10)
```

### 6.3 Canonical sequences

- **Turn:** `ROLL` → `ROLL_RESULT` → `MOVE` (+`SALARY_PAID`?) → landing event (`PURCHASE`/`RENT_CHARGED`/`TAX_PAID`/`CARD_DRAWN`/`AUDIT_APPLIED`/auction) → `TURN_CHANGED` (or another `ROLL` on doubles).
- **Auction:** `PASS`/timeout → `AUCTION_STARTED` → `BID`/`FOLD` (× players, `AUCTION_BID` per submit) → reveal `AUCTION_WON` → `PURCHASE`/transfer.
- **Insufficient funds:** debit attempt → `RAISE_FUNDS_REQUIRED` → `MORTGAGE_CHANGED`/`BUILD_CHANGED` … → `RAISE_FUNDS_DONE` (original payment events) **or** `BANKRUPTCY`.
- **Round limit:** `ROUND_COMPLETED` (round > max) → `ROUND_LIMIT_REACHED` → `VOTE_STARTED` → `VOTE_UPDATED`… → `VOTE_RESULT` → resume or `GAME_OVER`.

---

## 7. Game rules (engine specification)

### 7.1 Setup
Starting cash = effective `startingCash`. All players start at `start` (index 0). Turn order randomized via seeded RNG at `START_GAME`. City names loaded from country data into the board.

### 7.2 Turn structure
1. Active player `ROLL` → server rolls 2 dice (seeded).
2. Token moves step-by-step (`MOVE` path); passing/landing on `start` → Banker pays salary (`200`, ×2 if double-salary default).
3. Resolve landing tile (§7.3).
4. **Doubles** → roll again; **3rd consecutive double** → immediate audit (no move).
5. Turn ends (`END_TURN`) — auto after landing resolves or on `TURN_TIMEOUT_S`.

"Tap to continue" on the dice overlay is **cosmetic** — the server resolves landing immediately; the client just advances its animation queue.

### 7.3 Landing resolution
- **Unowned property/utility:** `pendingPurchase` → `BUY` or `PASS`. On pass/timeout: auction (auction-unsold default on) else stays with bank.
- **Owned (not yours, unmortgaged):** Banker charges rent → `RENT_CHARGED`. Can't afford → raise-funds.
- **Owned by you / mortgaged:** nothing.
- **Tax:** debit per tile `calculation` (`fixed` or `percentage of cash`).
- **`card_govt_notice` / `card_govt_grant`:** draw + apply effect (§7.9).
- **`go_to_audit`:** teleport to `audit` tile + apply audit.
- **`audit` (landed directly):** just visiting, no effect.
- **`rest_stop`:** neutral.

### 7.4 Rent
- 0 buildings, no monopoly: `rentLadder[0]`.
- 0 buildings, full district owned: `rentLadder[0] × 2`.
- >0 buildings: `rentLadder[buildings]`.
- Utilities: `diceTotal × (ownOne 4 | ownBoth 10)`.
- Mortgaged: rent 0.

### 7.5 Building
Requires full district, no mortgaged tile in it, **even-build** (no 2nd tower anywhere until all have 1; same for sell). Cost from district config; sell refund 50%. Supply unlimited. **Active player, own turn only.**

### 7.6 Mortgage
Mortgaging pays `mortgageValue`, rent → 0. Unmortgage costs `mortgageValue × 1.10`. Buildings must be sold first. **Own turn only** (except forced during raise-funds).

### 7.7 Insufficient funds / bankruptcy
- Debit > cash → `RAISE_FUNDS_REQUIRED`; original transaction **held** (atomic — nothing applies until covered).
- **Active player** gets the interactive Raise Funds flow (`pendingRaise` pauses only them; blocks their build/mortgage-as-management).
- **Non-active player** made insolvent by a card → Banker **auto-liquidates then auto-bankrupts** (no interactive modal).
- Cover → `RAISE_FUNDS_DONE` → complete payment. Else `DECLARE_BANKRUPTCY` (or auto on timeout).
- **Bankruptcy routing:** to a player (rent) → assets transfer to creditor, mortgaged deeds carry liens; to bank (tax/fine/card) → assets return to bank → **sequential auctions**. Player → spectator; `turnOrder` + `roundAnchor` recomputed; last-standing check.

### 7.8 Audit (jail replacement)
**Triggers:** `go_to_audit` tile, `gn_move_to_audit` card, 3 doubles. Player under audit up to `turns` (3). Each turn choose: **roll** (doubles → cleared + move; else attempt wasted, max `maxDoubleAttempts` 3), **pay** `settleCost` (100 → free, play normally), **use clearance card** (free, play normally). Auto-released after `turns`. While audited: still collects rent; cannot build/mortgage; cannot move unless doubles.

### 7.9 Cards
Two decks, seeded shuffle, drawn cards return to bottom (except `GET_AUDIT_CLEARANCE`, held as `clearanceCards`). Effects are engine enums; theme supplies flavor text per id.

**Govt Notice:** `gn_move_to_start` (MOVE_TO_TILE 0 +salary) · `gn_move_to_audit` (MOVE_TO_TILE 24 +applyAudit) · `gn_collect_100` (COLLECT_FIXED 100) · `gn_pay_150` (PAY_FIXED 150) · `gn_clearance_card` (GET_AUDIT_CLEARANCE) · `gn_extra_turn` (EXTRA_TURN).
**Govt Grant:** `gg_collect_from_all` (50) · `gg_pay_to_all` (50) · `gg_pay_per_building` (tower 40 / hq 115) · `gg_collect_per_player` (40) · `gg_property_discount` (50% next purchase → `pendingDiscount`) · `gg_free_build` (one free tower).

### 7.10 Auction (sealed-bid)
Triggered by pass-on-purchase (auction-unsold) or bankrupt-to-bank assets. `phase='auction'` (blocking sub-phase). All **active** players eligible; min bid = property price, max = cash. One sealed `BID` each (or `FOLD`). Amounts kept in server memory; `submittedIds` synced. Timer `bidTimerSeconds` (30) ends early when all submit; disconnect = no bid. Reveal: highest wins (`AUCTION_WON` + `allBids`); tie → seeded RNG; no valid bid → stays with bank. Bankrupt-to-bank = sequential auctions.

### 7.11 Rounds, continue-vote, win
- Round completes when the turn returns to `roundAnchor` → `round++` → `ROUND_COMPLETED`; `roundAnchor` recomputed on elimination.
- `round > maxRounds` (and not Unlimited) → `ROUND_LIMIT_REACHED` → `phase='round_vote'` (15s). Majority **continue** → `maxRounds += 10`, resume; ties/no-votes/timeouts/disconnects = **End** → `GAME_OVER`. Continue-vote is **always-on** for MVP.
- **Win:** last player standing (immediate, any time) → reason `last_standing`; or highest **net worth** at round-limit end → reason `net_worth_limit`.
- **Net worth (canonical):** `cash + Σ unmortgaged tile value + Σ building cost paid + ½ Σ mortgaged tile value`. One engine function, reused for standings.
- **Tiebreakers:** net worth → cash → properties owned → buildings owned → seeded coin-flip (record which fired).

### 7.12 RNG
Seeded PRNG; `rngSeed` + `rngCursor` server-side, in snapshots. All dice/shuffles/tie-breaks derive from it. Client dice animation is cosmetic.

---

## 8. Screen-by-screen reference

Flow: **Splash → Main Menu (Start/Join) → [Create Room | Join → Waiting Room] → Board (round loop) → Round Limit + Vote → Game Over.**
Source-layer tags: `[E]`ngine state · `[DB]` · `[T]`heme · `[B]`oard config · `[C]`ountry · `[CFG]` constants · `[D]`evice.

| # | Screen | Player does | Key data | Commands | Events / routing |
|---|---|---|---|---|---|
| 1 | **Splash** | passive | app version `[D]`; active-game pointer `[D]`; default theme `[T]` | — (anon sign-in; create `profiles`) | check room liveness → rejoin prompt |
| 2 | **Main Menu** | Start Game / Join Game | `profiles` name/avatar `[DB]` | — | nav (Shop/Friends/wallet/leaderboard hidden — out of scope) |
| 5 | **Create Room (host)** | set rounds/country/cash/theme; see live joiners; Start | code+seats `[E]`, theme catalog `[T]`, countries `[C]`, `MIN_PLAYERS` `[CFG]` | create-room → `SET_CONFIG`, `SET_COLOR`, `START_GAME` | `ROOM_UPDATED`, `PLAYER_JOINED`, `GAME_STARTED` |
| 6 | **Join Game (guest)** | enter name + 4-char code | code input `[D]`; room validity `[E]` | `JOIN {code,name}` (Colyseus `joinByCode`) | `PLAYER_JOINED`→Waiting; `ERROR`; started→`REJOIN` |
| 7 | **Waiting Room** | pick token color; see slots; read-only settings | seats/colors/config `[E]`; theme `[T]` | `SET_COLOR`, `LEAVE` | `ROOM_UPDATED`, `GAME_STARTED` |
| 8 | **Board** | Roll; View Assets; tap board; Bank log | players/deeds/positions/round/feed `[E]`; board `[B]`+`[C]`+`[T]` | `ROLL`, `END_TURN` | consumes the full event stream; routes to sub-screens |
| 9 | **Enlarged Board** | pan/zoom | same synced state | — | — (pure render) |
| 10 | **Dice/Move** | tap-to-continue (cosmetic) | active player `[E]`; dice/path from events | `ROLL` (from board) | `ROLL_RESULT`→`MOVE`→landing |
| 11 | **Purchase** | Buy / Pass | tile `[E]`, price/ladder `[B]`, cash `[E]`, `turnEndsAt` | `BUY`/`PASS {tileIndex}` | `PURCHASE` / `AUCTION_STARTED` / `TURN_CHANGED` |
| 12 | **Auction** | submit one sealed bid | `pendingAuction` (no amounts) `[E]`, price `[B]`, cash `[E]` | `BID {amount}` / `FOLD` | `AUCTION_STARTED`/`AUCTION_BID`/`AUCTION_WON` |
| 13 | **Toasts + Feed** | (output) | `feed` FeedEntry `[E]` | — | all money/property events (client renders text) |
| 14 | **Raise Funds** | mortgage/sell/pay/bankrupt | `pendingRaise` `[E]`, asset values `[B]` | `MORTGAGE`,`SELL_BUILDING`,`RAISE_FUNDS_DONE`,`DECLARE_BANKRUPTCY` | `MORTGAGE_CHANGED`,`BANKRUPTCY` |
| 15 | **Portfolio** | build/mortgage; (→ trade later) | own deeds `[E]`+`[B]`; net worth (derived) | `BUILD`,`SELL_BUILDING`,`MORTGAGE`,`UNMORTGAGE` | `BUILD_CHANGED`,`MORTGAGE_CHANGED` |
| 17 | **Audit** | pay/card/wait/roll | `player.audit` `[E]`, `auditRules` `[B]`, `clearanceCards` `[E]` | `RESOLVE_AUDIT`, `ROLL` | `AUDIT_APPLIED`/`AUDIT_RESOLVED` |
| 18 | **Round Limit + Vote** | vote continue/end | standings (derived), `pendingVote` `[E]`, `VOTE_DURATION_S` `[CFG]` | `VOTE_CONTINUE` | `ROUND_LIMIT_REACHED`,`VOTE_*`,`GAME_OVER` |
| 19 | **Game Over** | Play Again / Main Menu | winner/reason/standings `[E]`→`[DB]` | (nav) | `GAME_OVER` → write `matches` |

*Screens 3 (solo setup) & 4 (mode select) removed (multiplayer-only). Screen 16 (Trade) deferred.*

---

## 9. End-to-end development plan

> Each phase is independently testable. Build on the current scaffold (`index.ts` boots Colyseus + pings Supabase; `GameRoom` is a stub).

### Phase 0 — Foundations & reconciliation
- Reconcile shared types/config to the resolved model (§10): make `src/shared/types.ts` and `src/config` consistent — `audit` vocabulary, sealed-bid `Auction`, MVP command/event sets, `FeedEntry`, single `GAME_CONFIG`. Set `ROOM_CODE_LENGTH = 4`.
- Define the shared TypeScript contracts (commands, event payloads, enums) in one place reused by server (+ later client).
- Confirm Supabase project + run the §4.2 schema + RLS; verify service-role connection (already wired in `index.ts`).
- **Done when:** types compile, no `setback`/old-config references remain, schema applied.

### Phase 1 — Headless rules engine (no network)
- Pure `GameState` mutation engine + **Banker** primitive (atomic `bankTransfer`, raise-funds, bankruptcy).
- Implement: setup, turn loop, seeded RNG dice, buy/pass, rent (monopoly/buildings/utilities), build/sell (even-rule), mortgage, tax, cards (all effect keys), audit, salary, net worth.
- Rounds + anchor recompute, continue-vote logic (headless), win conditions, tiebreakers.
- Sealed-bid auction logic (server-memory bids, reveal, tie-break).
- **Done when:** unit tests cover every §7 rule; a scripted multi-player game completes deterministically under a fixed seed; cash/deed invariants hold under fuzz.

### Phase 2 — Colyseus integration (authoritative server)
- Model `GameState` as `@colyseus/schema` classes (§4.1); wrap the Phase-1 engine so mutations flow through schema.
- `GameRoom`: single-writer command handlers for the full MVP command set (§6.1); broadcast the MVP event set (§6.2); guards reject invalid commands (never mutate on invalid); `requestId` idempotency.
- Phase/turn state machine; turn timer + auto-play defaults; auction & vote sub-phase timers.
- Snapshot to `game_snapshots` per turn / phase change; rehydrate on restart.
- **Done when:** two scripted WS clients play a full game; invalid commands rejected; server restart mid-game rehydrates and continues.

### Phase 3 — Lobby, identity & reconnection
- Room creation (unique 4-char code + retry), `JOIN` via `joinByCode`, seats, `SET_COLOR` (unique per room), `START_GAME` (≥2).
- Anonymous auth verification on connect; bind socket → playerId; issue/validate `reconnectToken`.
- REJOIN flows (blip / app-close / restart); grace + AI takeover; duplicate-socket handling.
- **Done when:** real devices create/join/start; killing+reopening the app rejoins the same seat; <2 active → last-standing win.

### Phase 4 — Client wiring (screen by screen)
- Expo app: anon sign-in, secure-store pointer, `colyseus.js` room mirror over schema; one render path per screen in §8.
- Board via `react-native-skia`; token movement on `MOVE`; cosmetic dice; structured-feed/toast rendering (client composes text); auction/raise-funds/audit/vote/game-over flows.
- **Done when:** a 3-player online game plays start→finish across devices; dual rent notifications correct; all sub-flows in sync.

### Phase 5 — Theme system
- `theme.json` schema + **Azure Blob** layout + a **theme manifest** (`{id, displayName, thumbnail}`); client downloads + applies labels/art/palette; fallbacks for missing label/asset; default theme preselected.
- **Done when:** switching theme changes only look/labels; a broken theme falls back gracefully.

### Phase 6 — Persistence & hardening
- Write `matches` (standings) on game over; room lifecycle (finished/dispose).
- Turn §13/§12-style edge-case matrix into automated tests; rate limiting; structured logging + metrics; load test concurrent rooms.
- **Done when:** finished games persist correct standings; edge-case suite passes; no client-trust gaps.

### Post-MVP (see §11)
Trade · leaderboard (+ login/signup) · replay · AI opponents for full solo · spectators · host rule toggles · Shop/Friends.

---

## 10. Reconciliation tasks (stale code to fix in Phase 0)

`src/shared/types.ts` and `src/shared/config.ts` predate the resolved model:

1. **Terminology:** `setback`→`audit` everywhere — tile types, `player.setback`→`player.audit {turnsLeft, doubleAttempts}`, `RESOLVE_SETBACK`→`RESOLVE_AUDIT`, `SETBACK_APPLIED/RESOLVED`→`AUDIT_APPLIED/RESOLVED`. `card_chance/card_community`→`card_govt_notice/card_govt_grant`.
2. **`Auction` type** is ascending (`currentBid/leaderId/foldedIds`) — replace with sealed-bid shape (§4.1).
3. **`GameConfig`** — `src/shared/config.ts` `GAME_CONFIG` (with `SETBACK_*`, `SALARY`, `BOARD_TILES`) is superseded by `src/config/config.ts`. Remove the duplicate; salary/audit constants live in `board.config.ts`.
4. **`ROOM_CODE_LENGTH`** 6 → 4.
5. **Command/event sets** — drop `PROPOSE_TRADE`/`RESPOND_TRADE`/`TRADE_*` and `STATE_SYNC` for MVP; add `SET_COLOR`.
6. **`GameEvent.feed: string`** → structured `FeedEntry`.
7. **New fields:** `turnEndsAt`, `pendingPurchase`, `player.pendingDiscount`, `player.clearanceCards`, `player.isHost`.
8. **Typed `ERROR` codes** — define the set: `ROOM_NOT_FOUND`, `ROOM_FULL`/`ALREADY_STARTED`, `NOT_YOUR_TURN`, `INSUFFICIENT_FUNDS`, `INVALID_TILE`, `NOT_OWNER`, `COLOR_TAKEN`, `BAD_REQUEST`.
9. ~~**Token colors >4 players**~~ — done: `TokenColor` expanded to a 10-color palette (supports up to 10 players).

---

## 11. Deferred / post-MVP backlog

- **Trade** (first up) — Trade screen, `PROPOSE_TRADE`/`RESPOND_TRADE`, atomic both-sides validation, void-on-bankruptcy, anytime/async path.
- **Leaderboard** — needs durable accounts → bundle with **login/signup** flow; then `leaderboard` table + writes + screen.
- **Replay** — persist `event_log` + `rngSeed` in `matches`; reconstruct deterministically.
- **AI opponents / solo** — full all-AI mode (currently only disconnect-takeover AI in scope).
- **Spectators** — open spectating; non-member join currently hard-rejected.
- **Host rule toggles** — Quick Mode, Auction-unsold, Double-salary, continue-vote on/off, salary/turn-timer/max-players knobs.
- **Meta** — Shop, Friends/social, invites, coin wallet, How-to-Play.

---

## 12. Open items still to decide

1. ~~**Token colors with >4 players**~~ — **resolved:** `TokenColor` palette expanded to **10 colors** (red/blue/green/yellow/black/white/purple/orange/pink/cyan) → up to 10 distinct players; beyond 10 would need auto-assign.
2. **Theme manifest format/location** in Azure Blob (a JSON index file vs container listing) — needed by Phase 5.
3. **Local pass-and-play** confirmed out — re-confirm if "Play with friends on one device" is ever wanted.
4. **City names delivery to client** — bundled with the app vs sent in initial state vs fetched from DB `countries` (currently planned: bundled `countries.json`, baked into board at start).

---

_Companion docs: `PROJECT.md` (full long-term vision) · `stitch-doc.md` (UI/Stitch prompts). This `TECH_SPEC.md` is the MVP development source of truth; keep it updated as decisions change._
