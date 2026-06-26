/**
 * net/session.ts — high-level game session controller. Owns the room lifecycle
 * and bridges it into the zustand store: host / join / rejoin / leave, plus a
 * typed `command()`. Every room is wired so state changes become snapshots,
 * JOINED persists the active-game pointer + playerId, and ERROR sets the store
 * error. Screens call these; they never touch colyseus.js directly.
 */
import type { Room } from 'colyseus.js';
import { ensureAnonSession } from '../lib/supabase';
import { clearPointer, loadPointer, savePointer } from '../lib/storage';
import { generateRoomCode } from '../shared/codes';
import type { CommandPayloads, CommandType, ErrorCode, GameConfigKnobs } from '../shared/types';
import type { GameState } from '../state/schema';
import { toSnapshot } from '../state/snapshot';
import { useGameStore } from '../state/store';
import { createGame, joinGame, rejoinGame, send } from './colyseus';

interface JoinedMsg {
  playerId: string;
  code: string;
  reconnectToken: string;
}

const KNOWN_CODES: ErrorCode[] = [
  'ROOM_NOT_FOUND',
  'ALREADY_STARTED',
  'ROOM_FULL',
  'NOT_HOST',
  'TOO_FEW_PLAYERS',
  'COLOR_TAKEN',
  'NOT_YOUR_TURN',
  'INSUFFICIENT_FUNDS',
  'INVALID_TILE',
  'NOT_OWNER',
  'ILLEGAL_ACTION',
  'BAD_REQUEST',
];

function mapError(e: unknown): ErrorCode {
  const msg = e instanceof Error ? e.message : String(e);
  const hit = KNOWN_CODES.find((c) => msg.includes(c));
  if (hit) return hit;
  if (/not found|no rooms|seat reservation/i.test(msg)) return 'ROOM_NOT_FOUND';
  return 'BAD_REQUEST';
}

// The local player's name, captured at host/join time so the JOINED handler can
// persist it in the pointer (the server's JOINED message carries no name).
let pendingName = '';

function wire(room: Room<GameState>): void {
  const store = useGameStore.getState();
  store.setRoom(room);

  // Initial state may not be fully decoded the instant create()/join() resolves;
  // guard so a transient snapshot error doesn't fail the whole connect — the
  // next onStateChange will populate it.
  const snap = (s: GameState) => {
    try {
      useGameStore.getState().setSnapshot(toSnapshot(s));
    } catch (e) {
      console.error('session: snapshot build failed', e);
    }
  };
  snap(room.state);
  room.onStateChange(snap);

  room.onMessage('JOINED', (m: JoinedMsg) => {
    // Diagnostic: two clients sharing one anonymous identity (e.g. two tabs in
    // the same browser) get the SAME playerId → the joiner reclaims the host's
    // seat instead of adding a new one. Compare this across your two clients.
    console.log('session: JOINED — room', m.code, 'playerId', m.playerId);
    useGameStore.getState().setPlayerId(m.playerId);
    void savePointer({ code: m.code, playerId: m.playerId, reconnectToken: m.reconnectToken, name: pendingName });
  });

  room.onMessage('ERROR', (m: { code: ErrorCode }) => useGameStore.getState().setError(m.code));

  room.onError((_code, message) => console.error('GameRoom: socket error', message));
  room.onLeave(() => useGameStore.getState().setStatus('idle'));
}

/** Ensure an anonymous Supabase session exists (token cached for create/join). */
export async function bootAuth(): Promise<void> {
  try {
    await ensureAnonSession();
  } catch (e) {
    console.error('session: anonymous sign-in failed', e);
  }
}

/** Host a new room with the given name + config knobs. Throws on failure. */
export async function host(opts: { name: string } & GameConfigKnobs): Promise<void> {
  const store = useGameStore.getState();
  store.setStatus('connecting');
  store.setError(null);
  pendingName = opts.name;
  try {
    const token = await ensureAnonSession();
    const room = await createGame({ code: generateRoomCode(), token, ...opts });
    wire(room);
    store.setStatus('connected');
  } catch (e) {
    console.error('session: host() failed', e);
    useGameStore.getState().setStatus('error');
    useGameStore.getState().setError(mapError(e));
    throw e;
  }
}

/** Join an existing room by code. Throws on failure (status/error set in store). */
export async function joinByCode(code: string, name: string): Promise<void> {
  const store = useGameStore.getState();
  store.setStatus('connecting');
  store.setError(null);
  pendingName = name;
  try {
    const token = await ensureAnonSession();
    const room = await joinGame(code, name, token);
    wire(room);
    store.setStatus('connected');
  } catch (e) {
    console.error('session: joinByCode() failed', e);
    useGameStore.getState().setStatus('error');
    useGameStore.getState().setError(mapError(e));
    throw e;
  }
}

/** Attempt to rejoin from the persisted pointer (app reopen / drop). */
export async function tryRejoin(): Promise<boolean> {
  const ptr = await loadPointer();
  if (!ptr) return false;
  pendingName = ptr.name ?? '';
  const store = useGameStore.getState();
  store.setStatus('connecting');
  try {
    const token = await ensureAnonSession();
    const room = await rejoinGame(ptr.code, ptr.playerId, ptr.reconnectToken, token);
    wire(room);
    useGameStore.getState().setPlayerId(ptr.playerId);
    useGameStore.getState().setStatus('connected');
    return true;
  } catch {
    // Keep the pointer on failure — a transient error (server momentarily down,
    // restart window) must not destroy the ability to resume on the next try.
    // The pointer is only cleared on an explicit LEAVE or a confirmed game-over.
    useGameStore.getState().setStatus('idle');
    return false;
  }
}

/** Leave the room, clear the pointer, and reset the store. */
export async function leaveGame(): Promise<void> {
  const { room } = useGameStore.getState();
  if (room) {
    try {
      await room.leave(true);
    } catch (e) {
      console.error('session: leave failed', e);
    }
  }
  await clearPointer();
  useGameStore.getState().reset();
}

/** Send a typed command to the active room (no-op if not connected). */
export function command<T extends CommandType>(type: T, payload: CommandPayloads[T]): void {
  const { room } = useGameStore.getState();
  if (room) send(room, type, payload);
}
