/**
 * state/store.ts — the client's single store (zustand). Holds the active room,
 * the local playerId, a plain GameSnapshot (rebuilt on every state change by the
 * session controller), connection status, and the last error code. Screens
 * select from here; they never read the raw schema.
 */
import type { Room } from 'colyseus.js';
import { create } from 'zustand';
import type { ErrorCode, StandingRow, WinReason } from '../shared/types';
import type { GameState } from './schema';
import type { GameSnapshot } from './snapshot';

export type ConnStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type GameResult = { winnerId: string | null; reason: WinReason; standings: StandingRow[] };

interface GameStore {
  room: Room<GameState> | null;
  playerId: string | null;
  snapshot: GameSnapshot | null;
  status: ConnStatus;
  error: ErrorCode | null;
  result: GameResult | null;

  setRoom: (room: Room<GameState> | null) => void;
  setPlayerId: (playerId: string | null) => void;
  setSnapshot: (snapshot: GameSnapshot | null) => void;
  setStatus: (status: ConnStatus) => void;
  setError: (error: ErrorCode | null) => void;
  setResult: (result: GameResult | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  room: null,
  playerId: null,
  snapshot: null,
  status: 'idle',
  error: null,
  result: null,

  setRoom: (room) => set({ room }),
  setPlayerId: (playerId) => set({ playerId }),
  setSnapshot: (snapshot) => set({ snapshot }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setResult: (result) => set({ result }),
  reset: () => set({ room: null, playerId: null, snapshot: null, status: 'idle', error: null, result: null }),
}));
