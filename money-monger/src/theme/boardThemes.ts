/**
 * theme/boardThemes.ts — per-theme palette for the board. Every block shares a
 * single default top-band color (the band switches to the owner's color once a
 * property is bought). The four corners get their own full-tile design. Keyed
 * by the game's themeId (Phase 5 adds more themes); unknown themes fall back to
 * 'default'.
 */
import type { ImageSourcePropType } from 'react-native';
import type { BoardTile } from '../config/board.config';

export interface CornerStyle {
  bg: string; // full-tile fill
  fg: string; // text/emoji color
  emoji: string; // decorative glyph (fallback when no image)
  label: string;
  // Optional PNG for the corner. Drop files in assets/corners/ and set this to
  // a require() (e.g. require('../../assets/corners/go.png')). When present the
  // image renders instead of the emoji.
  image?: ImageSourcePropType;
}

export interface BoardTheme {
  band: string; // default top-bar color shared by every (unowned) block
  // the four corners get a full-tile colored design, keyed by tile type
  corners: Record<string, CornerStyle>;
}

// Board indices of the four corners (9×9 perimeter, clockwise from bottom-right).
export const CORNER_INDICES = new Set([0, 8, 16, 24]);

export const BOARD_THEMES: Record<string, BoardTheme> = {
  // A cohesive, slightly jewel-toned set that reads well on the cream surface
  // behind the brutalist ink borders.
  default: {
    band: '#ff00001c', // deep indigo-slate — distinct from every player token color
    corners: {
      // To use PNGs, drop the files in assets/corners/ and uncomment the matching
      // `image:` line (paths are relative to this file). Until then the emoji shows.
      start: { bg: '#1f7a48', fg: '#eafff1', emoji: '🏁', label: '', image: require('../../assets/corners/go.png') },
      rest_stop: { bg: '#15706f', fg: '#e7ffff', emoji: '☕', label: '', image: require('../../assets/corners/rest.png') },
      go_to_audit: { bg: '#7a2e2e', fg: '#ffe9e7', emoji: '🚨', label: '', image: require('../../assets/corners/go-to-audit.png') },
      audit: { bg: '#414d6b', fg: '#e9eeff', emoji: '🔍', label: '', image: require('../../assets/corners/audit.png') },
    },
  },
};

export function boardTheme(themeId?: string): BoardTheme {
  return BOARD_THEMES[themeId ?? 'default'] ?? BOARD_THEMES.default;
}

/** The theme's default top-band color, shared by every block (before any
 *  owner-color override applied at the call site). */
export function tileBandColor(theme: BoardTheme): string {
  return theme.band;
}

/** Corner design for the four corner tiles, or undefined for a normal tile. */
export function cornerStyle(theme: BoardTheme, index: number, tile?: BoardTile): CornerStyle | undefined {
  if (!tile || !CORNER_INDICES.has(index)) return undefined;
  return theme.corners[tile.type];
}
