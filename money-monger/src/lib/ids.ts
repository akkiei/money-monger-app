/**
 * lib/ids.ts — id generation. The get-random-values import polyfills the global
 * crypto used by libraries on native.
 */
import 'react-native-get-random-values';
import * as Crypto from 'expo-crypto';

// Per-command requestId (server dedupes retries on it).
export function requestId(): string {
  return Crypto.randomUUID();
}
