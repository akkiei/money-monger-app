/**
 * lib/env.ts — client env. EXPO_PUBLIC_* vars are inlined into the bundle by
 * Expo at build time (safe for the anon key + ws url; NEVER put secrets here).
 */
export const ENV = {
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  GAME_WS_URL: process.env.EXPO_PUBLIC_GAME_WS_URL ?? 'ws://localhost:2567',
};
