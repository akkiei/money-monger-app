/**
 * net/colyseus.ts — low-level game-server transport (colyseus.js). Create / join
 * / rejoin the `game_room` and a typed `send`. Lifecycle wiring (state → store,
 * JOINED → pointer, errors) lives in net/session.ts; this file is pure transport.
 * filterBy(['code']) on the server routes join({code}) to the host's room.
 */
import { Client, Room } from 'colyseus.js';
import { ENV } from '../lib/env';
import { requestId } from '../lib/ids';
import type { CommandPayloads, CommandType, GameConfigKnobs } from '../shared/types';
import type { GameState } from '../state/schema';

let _client: Client | null = null;
export function gameClient(): Client {
  return (_client ??= new Client(ENV.GAME_WS_URL));
}

export interface CreateOpts extends Partial<GameConfigKnobs> {
  code: string;
  name: string;
  token?: string;
}

export function createGame(opts: CreateOpts): Promise<Room<GameState>> {
  return gameClient().create<GameState>('game_room', opts);
}

export function joinGame(code: string, name: string, token?: string): Promise<Room<GameState>> {
  return gameClient().join<GameState>('game_room', { code, name, token });
}

// joinOrCreate (not join): if the server restarted and the in-memory room is
// gone, this recreates it, which triggers the server's snapshot rehydrate path.
// An existing room is still matched by filterBy(['code']) and simply joined.
export function rejoinGame(
  code: string,
  playerId: string,
  reconnectToken: string,
  token?: string,
): Promise<Room<GameState>> {
  return gameClient().joinOrCreate<GameState>('game_room', { code, playerId, reconnectToken, token });
}

// Typed command send: `{ requestId, payload }` envelope the server expects.
export function send<T extends CommandType>(room: Room<GameState>, type: T, payload: CommandPayloads[T]): void {
  room.send(type, { requestId: requestId(), payload });
}
