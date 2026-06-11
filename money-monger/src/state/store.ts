/**
 * state/store.ts — the client's single store (zustand). Holds the active room +
 * connection status. The board/screens read synced state via room.onStateChange
 * (added when we build the board); ephemeral events via room.onMessage.
 */
import type { Room } from 'colyseus.js';
import { create } from 'zustand';

interface GameStore {
  room: Room | null;
  connected: boolean;
  setRoom: (room: Room | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  room: null,
  connected: false,
  setRoom: (room) => set({ room, connected: room !== null }),
}));
