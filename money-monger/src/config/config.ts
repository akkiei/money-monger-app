/**
 * config.ts
 * ─────────────────────────────────────────────────────────────
 * Game-wide constants that are NOT part of the board definition.
 * Board mechanics (audit rules, salary, auction timer) live in
 * board.config.ts — this file covers session, timing, and
 * server behaviour constants.
 * ─────────────────────────────────────────────────────────────
 */

export const GAME_CONFIG = {
  // ── Starting state ────────────────────────────────────────
  STARTING_CASH: 1500,

  // ── Rounds ───────────────────────────────────────────────
  DEFAULT_MAX_ROUNDS: 20, // host can set: 10 / 20 / 30 / unlimited
  CONTINUE_INCREMENT_N: 10, // rounds added if continue-vote passes
  VOTE_DURATION_S: 15, // continue-vote countdown (seconds)

  // ── Turn ─────────────────────────────────────────────────
  TURN_TIMEOUT_S: 30, // seconds before Banker auto-plays defaults
  MAX_DOUBLES_IN_A_ROW: 3, // 3rd double → immediate audit

  // ── Mortgage ─────────────────────────────────────────────
  UNMORTGAGE_INTEREST_RATE: 0.1, // 10% interest on top of mortgage value

  // ── Reconnection & presence ───────────────────────────────
  DISCONNECT_GRACE_S: 120, // seconds seat is held before AI takeover
  AI_TAKEOVER_AFTER_ROUNDS: 2, // missed rounds before AI takes the seat

  // ── Room ─────────────────────────────────────────────────
  ROOM_CODE_LENGTH: 4, // characters in the join code (A–Z, 2–9; excludes 0/O/1/I/L)
  MIN_PLAYERS_TO_START: 2,

  // ── Snapshot ─────────────────────────────────────────────
  SNAPSHOT_EVERY_N_TURNS: 1, // persist GameState to Supabase every turn
} as const;

// Type export for use across server and client
export type GameConfig = typeof GAME_CONFIG;
