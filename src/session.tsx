import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

import { getDataApi, peekBackend } from '@/src/data';
import type { DataApi, Profile, Session } from '@/src/data/types';
import { isAuthCallbackUrl } from '@/src/lib/auth-callback';

type DataContextValue = {
  api: DataApi;
  backend: 'mock' | 'supabase';
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  authLinkError: string | null;
  refreshProfile: () => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

function currentHref(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.href;
  }
  return null;
}

function stripAuthParamsFromUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  if (!url.search && !url.hash) return;
  url.search = '';
  url.hash = '';
  window.history.replaceState({}, '', url.pathname + url.search);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => getDataApi(), []);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);

  async function loadProfile(next: Session | null) {
    if (!next) {
      setProfile(null);
      return;
    }
    const p = await api.getProfile(next.userId);
    setProfile(p);
  }

  useEffect(() => {
    let alive = true;

    async function ingest(url: string | null) {
      if (!url || !isAuthCallbackUrl(url)) return;
      try {
        const next = await api.consumeAuthUrl(url);
        if (!alive) return;
        setAuthLinkError(null);
        if (next) {
          setSession(next);
          await loadProfile(next);
          stripAuthParamsFromUrl();
        }
      } catch (e) {
        if (!alive) return;
        setAuthLinkError(e instanceof Error ? e.message : 'Посилання недійсне');
      }
    }

    (async () => {
      const href = currentHref();
      if (href && isAuthCallbackUrl(href)) {
        await ingest(href);
      }
      const initial = await Linking.getInitialURL();
      if (initial) await ingest(initial);
      const s = await api.getSession();
      if (!alive) return;
      setSession(s);
      await loadProfile(s);
      if (alive) setReady(true);
    })();

    const unsub = api.onAuthChange((s) => {
      setSession(s);
      void loadProfile(s);
    });
    const linkSub = Linking.addEventListener('url', (event) => {
      void ingest(event.url);
    });
    return () => {
      alive = false;
      unsub();
      linkSub.remove();
    };
  }, [api]);

  const value: DataContextValue = {
    api,
    backend: peekBackend(),
    ready,
    session,
    profile,
    authLinkError,
    refreshProfile: () => loadProfile(session),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}
