/**
 * shared/codes.ts
 * 4-char room codes. Charset excludes ambiguous characters (0/O/1/I/L) so a
 * code is readable aloud. Shared with the client (which generates a candidate);
 * the server validates uniqueness against rooms.code on create.
 */
import { GAME_CONFIG } from "../config/config";

// A–Z without O  +  2–9  → 33 characters, @# - special chars. 
export const CODE_CHARS = "#@ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(
  length: number = GAME_CONFIG.ROOM_CODE_LENGTH,
): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  // TODO: add quick db check for existence when creating a room
  return code;
}

export function isValidRoomCode(code: string): boolean {
  return (
    typeof code === "string" &&
    code.length === GAME_CONFIG.ROOM_CODE_LENGTH &&
    [...code].every((c) => CODE_CHARS.includes(c))
  );
}
