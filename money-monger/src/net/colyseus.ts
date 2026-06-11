/**
 * net/colyseus.ts — game-server connection (colyseus.js). Create/join/rejoin
 * `game_room`, persist the active-game pointer on JOINED, and a typed `send`.
 * filterBy(['code']) on the server routes join({code}) to the host's room.
 */
import { Client, Room } from 'colyseus.js';
import { ENV } from '../lib/env';
import { requestId } from '../lib/ids';
import { savePointer } from '../lib/storage';
import type { CommandPayloads, CommandType, GameConfigKnobs } from '../shared/types';

let _client: Client | null = null;
export function gameClient(): Client {
  return (_client ??= new Client(ENV.GAME_WS_URL));
}

interface JoinedMsg {
  playerId: string;
  code: string;
  reconnectToken: string;
}

function bindJoined(room: Room): void {
  room.onMessage('JOINED', (m: JoinedMsg) => {
    void savePointer({ code: m.code, playerId: m.playerId, reconnectToken: m.reconnectToken });
  });
}

export interface CreateOpts extends Partial<GameConfigKnobs> {
  code: string;
  name: string;
  token?: string;
}

export async function createGame(opts: CreateOpts): Promise<Room> {
  const room = await gameClient().create('game_room', opts);
  bindJoined(room);
  return room;
}

export async function joinGame(code: string, name: string, token?: string): Promise<Room> {
  const room = await gameClient().join('game_room', { code, name, token });
  bindJoined(room);
  return room;
}

export async function rejoinGame(
  code: string,
  playerId: string,
  reconnectToken: string,
  token?: string,
): Promise<Room> {
  const room = await gameClient().join('game_room', { code, playerId, reconnectToken, token });
  bindJoined(room);
  return room;
}

// Typed command send: `{ requestId, payload }` envelope the server expects.
export function send<T extends CommandType>(
  room: Room,
  type: T,
  payload: CommandPayloads[T],
): void {
  room.send(type, { requestId: requestId(), payload });
}
