/**
 * lib/supabase.ts — anonymous-first Supabase client. Uses the ANON key only
 * (never the service-role key). Session persisted via our storage adapter.
 */
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';
import { getItem, removeItem, setItem } from './storage';

const authStorage = { getItem, setItem, removeItem };

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Ensure an anonymous session exists; returns the access token (→ server onAuth).
export async function ensureAnonSession(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return session.access_token;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) throw error ?? new Error('anonymous sign-in failed');
  return data.session.access_token;
}
