import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getDataApi, peekBackend } from '@/src/data';
import type { DataApi, Profile, Session } from '@/src/data/types';

type DataContextValue = {
  api: DataApi;
  backend: 'mock' | 'supabase';
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const api = useMemo(() => getDataApi(), []);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

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
    (async () => {
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
    return () => {
      alive = false;
      unsub();
    };
  }, [api]);

  const value: DataContextValue = {
    api,
    backend: peekBackend(),
    ready,
    session,
    profile,
    refreshProfile: () => loadProfile(session),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}
