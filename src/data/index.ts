import { isSupabaseConfigured } from '@/src/lib/supabase';

import { createMockApi } from './mock';
import { createSupabaseApi } from './supabase';
import type { DataApi } from './types';

export type { ChatMessage, ChatThread, DataApi, Pin, Profile, Session } from './types';
export { DataError } from './types';
export { MOCK_OTP } from './mock';
export { isSupabaseConfigured } from '@/src/lib/supabase';
export { pinNeedsContinue, daysUntilExpiry } from './renewal';

let cached: DataApi | null = null;

/** Mock when Expo env is unset; Supabase client when both public env vars are set. */
export function getDataApi(): DataApi {
  if (cached) return cached;
  cached = isSupabaseConfigured() ? createSupabaseApi() : createMockApi();
  return cached;
}

export function peekBackend(): 'mock' | 'supabase' {
  return isSupabaseConfigured() ? 'supabase' : 'mock';
}
