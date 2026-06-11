/**
 * lib/storage.ts — key/value storage. expo-secure-store on native; localStorage
 * on web (secure-store has no web implementation). Also the active-game pointer
 * { code, playerId, reconnectToken } persisted for REJOIN.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const POINTER_KEY = 'active-game-pointer';

export interface GamePointer {
  code: string;
  playerId: string;
  reconnectToken: string;
}

export async function savePointer(p: GamePointer): Promise<void> {
  await setItem(POINTER_KEY, JSON.stringify(p));
}

export async function loadPointer(): Promise<GamePointer | null> {
  const raw = await getItem(POINTER_KEY);
  return raw ? (JSON.parse(raw) as GamePointer) : null;
}

export async function clearPointer(): Promise<void> {
  await removeItem(POINTER_KEY);
}
