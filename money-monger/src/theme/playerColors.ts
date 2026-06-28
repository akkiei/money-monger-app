/**
 * theme/playerColors.ts — maps a server-assigned TokenColor to a hex value for
 * tokens, avatars, and owned-property blocks. The server assigns each player a
 * unique color on join (see engine/state.pickColor); the client only renders it.
 */
import type { TokenColor } from '../shared/types';

export const TOKEN_HEX: Record<TokenColor, string> = {
  red: '#e63b2e',
  blue: '#0055ff',
  green: '#1aa64b',
  yellow: '#ffcc00',
  purple: '#7b2ff7',
  orange: '#ff8c2e',
  pink: '#ff4fa3',
  cyan: '#00b3c4',
  aqua: '#13ffff',
  magenta: '#ff01ff'
};

// Fallback order for seats without an assigned color yet (keyed by seat index).
export const COLOR_FALLBACK: TokenColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'cyan',
  'aqua',
  'magenta',
];

/** Resolve a token color name to hex; falls back to a per-seat color if unset. */
export function tokenHex(color: string | undefined, seatIndex = 0): string {
  if (color && color in TOKEN_HEX) return TOKEN_HEX[color as TokenColor];
  return TOKEN_HEX[COLOR_FALLBACK[seatIndex % COLOR_FALLBACK.length]];
}

// A distinct pawn emoji per token color. Colors are assigned randomly + uniquely
// on join, so each player effectively gets a random, unique emoji that every
// client renders identically (no server change needed).
export const PLAYER_EMOJI: Record<TokenColor, string> = {
  red: '🦊',
  blue: '🐳',
  green: '🐸',
  yellow: '🐥',
  purple: '🦄',
  orange: '🦁',
  pink: '🐷',
  cyan: '🐬',
  aqua: '🐢',
  magenta: '🦩',
};

/** The pawn emoji for a player's color; falls back per seat if color is unset. */
export function playerEmoji(color: string | undefined, seatIndex = 0): string {
  if (color && color in PLAYER_EMOJI) return PLAYER_EMOJI[color as TokenColor];
  return PLAYER_EMOJI[COLOR_FALLBACK[seatIndex % COLOR_FALLBACK.length]];
}
