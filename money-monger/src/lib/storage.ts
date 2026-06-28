/**
 * lib/storage.ts — key/value storage. expo-secure-store on native; localStorage
 * on web (secure-store has no web implementation). Also the active-game pointer
 * { code, playerId, reconnectToken } persisted for REJOIN.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// DEV-only on web: namespace storage per browser TAB (sessionStorage is per-tab)
// so two tabs in one browser get distinct anonymous identities — lets you test
// multiplayer locally. In production (__DEV__ false) keys are shared as normal
// (persistent identity via localStorage). Native devices are already distinct.
function tabPrefix(): string {
  if (Platform.OS !== 'web' || !__DEV__) return '';
  try {
    let id = sessionStorage.getItem('mm-tab-id');
    if (!id) {
      id = Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('mm-tab-id', id);
    }
    return `tab_${id}:`;
  } catch {
    return '';
  }
}
const NS = tabPrefix();

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(NS + key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(NS + key);
  return SecureStore.getItemAsync(key);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(NS + key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const POINTER_KEY = 'active-game-pointer';

export interface GamePointer {
  code: string;
  playerId: string;
  reconnectToken: string;
  name?: string; // the local player's name, for the resume prompt on relaunch
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
