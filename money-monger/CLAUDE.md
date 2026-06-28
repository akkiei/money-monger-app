# money-monger-app — client (React Native + Expo)

This is the **mobile/web client** for an original, Monopoly-inspired multiplayer
board game. The **authoritative game server** lives in a **separate repo**
(`boardgame-server`, Node + Colyseus + TypeScript). This app renders state and
sends commands — **it contains no game rules**; the server decides everything.

> Full spec: **`docs/TECH_SPEC.md`** (copied from the server repo; the MVP source
> of truth). Read it before building screens or the networking layer.

---

## What this app does

A player opens the app → silent anonymous Supabase sign-in → **Start Game**
(host, creates a room) or **Join Game** (enter a room code). The host configures
rounds / country / starting cash / theme, then starts. All devices then render
the live board over a Colyseus WebSocket and play turns (roll → move → buy/auction
→ rent/tax/cards → audit → build/mortgage → round limit → continue-vote → game over).

**Multiplayer only** (no solo mode). 2+ players, no max. Trade is deferred (not in MVP).

---

## How the client talks to the server

Transport: **`colyseus.js`** to the room type **`game_room`**. Authoritative state
arrives via **`@colyseus/schema` delta-sync** (cash, deeds, positions, phase,
`pending*`, `feed`); ephemeral **broadcast events** drive toasts/animation only.

### Connect & identity
- On first launch: Supabase **anonymous sign-in** (`@supabase/supabase-js`) → access token.
- Pass the token in join options: the server `onAuth` verifies it → that becomes your `playerId`.
- Persist the **active-game pointer** `{ roomCode, playerId, reconnectToken }` in `expo-secure-store`.

### Create / join / rejoin
```ts
// Host creates a room (code = a 4-char candidate from src/shared/codes.generateRoomCode)
const room = await client.create('game_room', {
  code, name, token,                 // token = Supabase access token
  countryId, startingCash, themeId, maxRounds,   // host knobs
});

// Guest joins by code (server routes via filterBy(['code']))
const room = await client.join('game_room', { code, name, token });

// Server replies with a 'JOINED' message → persist the pointer:
room.onMessage('JOINED', ({ playerId, code, reconnectToken }) => savePointer(...));

// Rejoin after app reopen / drop:
const room = await client.join('game_room', { code, playerId, reconnectToken });
```

### Sending commands
A command message is `{ requestId, payload }` for its type; the server dedupes on `requestId`.
```ts
room.send('ROLL', { requestId: uuid(), payload: {} });
room.send('BUY',  { requestId: uuid(), payload: { tileIndex } });
room.send('SET_CONFIG', { requestId: uuid(), payload: { maxRounds, countryId, startingCash, themeId } });
```
Full command + payload list: **`src/shared/types.ts`** (`CommandType`, `CommandPayloads`).
On an invalid command the server sends an `ERROR { code, requestId }` to you only.

### Receiving
- **State** (source of truth): `room.onStateChange` / `room.state` — the `@colyseus/schema` `GameState`
  (shape mirrored in `src/state/schema.ts`).
- **Events** (toasts/animation/feed): `room.onMessage(type, ...)` — `ROLL_RESULT`, `MOVE`,
  `RENT_CHARGED`, `AUCTION_BID/WON`, `TURN_CHANGED`, `VOTE_*`, `GAME_OVER`, `PLAYER_PRESENCE`, …
  (`EventType` / `EventPayloads` in `src/shared/types.ts`).
- **Feed & toasts**: the server emits **structured data only** (ids / tileIndex / amount). The
  CLIENT composes all display text from theme + country + board config. Dual rent notification =
  one `RENT_CHARGED { payerId, receiverId, amount }` → show coral "you paid" / gold "you received"
  / neutral feed by comparing to your own `playerId`.

---

## Rendering the board (three config layers)

The engine/server only deals in **ids/indices** — never display names. The client composes labels:

1. **`src/config/board.config.ts`** — tile indices, prices, rent ladders, tax math, card *effects*. Static.
2. **`src/config/countries.json`** — district/city names + currency, keyed by `countryId` + `tileIndex`.
   (India default · USA · UK.)
3. **`theme.json`** (in **Azure Blob storage**, downloaded at runtime) — labels (e.g. `audit` → "Tax Audit"),
   palette, art, sounds, card flavor text. One theme preselected by default. The server only stores `themeId`.

Engine key reference (relabel via theme): tiles `start | audit | go_to_audit | rest_stop | property |
utility | tax | card_govt_notice | card_govt_grant`. `''` ownerId = bank; `maxRounds = -1` = Unlimited.

---

## Screens (19) — see `docs/TECH_SPEC.md` §8 for the full table

Splash → Main Menu (**Start / Join**) → Create Room (host) | Join → Waiting Room → **Board** (round loop:
Dice · Purchase · Auction · Toasts/Feed · Raise-Funds · Portfolio · Audit) → Round Limit + Continue Vote →
Game Over. (Solo "Game Setup" + "Mode Select" screens are dropped; **Trade** screen deferred.)

---

## Locked decisions (don't relitigate without reason)

- Multiplayer-only; **two-button entry** (Start / Join).
- **4-char room code** (`src/shared/codes.ts` — note: keep it human-readable/typeable).
- Host knobs (MVP): **rounds, country, starting cash, theme** only.
- **Themes via Azure Blob** `theme.json` (+ a manifest for the picker); client downloads + applies.
- **Hidden info** (sealed auction bids) is never in synced state — revealed via `AUCTION_WON` broadcast.
- Continue-vote is in; trade, leaderboard, spectators, solo are post-MVP.

---

## Recommended stack

`expo` (managed) + `expo-router` · `colyseus.js` · `@supabase/supabase-js` v2 · `expo-secure-store` ·
`react-native-skia` (board) · `react-native-reanimated` (dice/token/toast) · `zustand` (mirror server
events via one `applyEvent` reducer) · `react-native-svg`. Web build is the free fallback (ship web +
Android first; iOS later).

---

## Shared contracts (`src/shared`, `src/state`, `src/config`)

These files are **copied from `boardgame-server`** (the client↔server contract). Keep them in sync with
the server; long-term they may become a published `@monop/shared` package. Do not edit them to change
behavior — they describe what the server already enforces.

- `src/shared/types.ts` — commands, events, payloads, enums, `ErrorCode`, `GameConfigKnobs`.
- `src/shared/codes.ts` — room-code generate/validate.
- `src/state/schema.ts` — the synced `GameState` shape (reference; `@colyseus/schema` classes).
- `src/config/*` — board + countries + session constants.
