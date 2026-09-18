import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const CHUNK = 1800;

function memoryStorage(): StorageAdapter {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
  };
}

async function nativeSecureStorage(): Promise<StorageAdapter> {
  const SecureStore = await import('expo-secure-store');
  return {
    async getItem(key) {
      const parts: string[] = [];
      for (let i = 0; ; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}.${i}`);
        if (chunk == null) break;
        parts.push(chunk);
      }
      if (parts.length === 0) {
        return SecureStore.getItemAsync(key);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      await SecureStore.deleteItemAsync(key);
      for (let i = 0; i * CHUNK < value.length; i++) {
        await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
      }
      // sentinel: delete leftover chunks
      for (let i = Math.ceil(value.length / CHUNK); ; i++) {
        const existing = await SecureStore.getItemAsync(`${key}.${i}`);
        if (existing == null) break;
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
    },
    async removeItem(key) {
      await SecureStore.deleteItemAsync(key);
      for (let i = 0; ; i++) {
        const existing = await SecureStore.getItemAsync(`${key}.${i}`);
        if (existing == null) break;
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
    },
  };
}

function webStorage(): StorageAdapter {
  const ls = globalThis.localStorage;
  if (!ls) return memoryStorage();
  return {
    getItem: async (key) => ls.getItem(key),
    setItem: async (key, value) => {
      ls.setItem(key, value);
    },
    removeItem: async (key) => {
      ls.removeItem(key);
    },
  };
}

let adapterPromise: Promise<StorageAdapter> | null = null;

function getAuthStorage(): Promise<StorageAdapter> {
  if (!adapterPromise) {
    adapterPromise =
      Platform.OS === 'web' ? Promise.resolve(webStorage()) : nativeSecureStorage().catch(() => memoryStorage());
  }
  return adapterPromise;
}

const authStorage: StorageAdapter = {
  getItem: (key) => getAuthStorage().then((s) => s.getItem(key)),
  setItem: (key, value) => getAuthStorage().then((s) => s.setItem(key, value)),
  removeItem: (key) => getAuthStorage().then((s) => s.removeItem(key)),
};

export function readSupabaseEnv(): { url: string; anonKey: string } {
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
  const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  return { url, anonKey };
}

/** True only when both Expo public env vars are set. Otherwise the mock store is used. */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = readSupabaseEnv();
  return url.startsWith('https://') && anonKey.length > 20;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;
  const { url, anonKey } = readSupabaseEnv();
  client = createClient(url, anonKey, {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Web magic-link returns tokens in the URL; native uses the 6-digit email OTP.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  return client;
}
