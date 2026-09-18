import type { Session as SbSession, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { t } from '@/src/i18n';
import { isValidEmail, normalizeEmail } from '@/src/lib/email';
import { getSupabase } from '@/src/lib/supabase';

import {
  DataError,
  type DataApi,
  type Pin,
  type PinCategory,
  type PinKind,
  type PinMedia,
  type PinStatus,
  type Profile,
  type Session,
  type Vertical,
} from './types';

type PinRow = {
  id: string;
  author_id: string;
  kind: PinKind;
  vertical: Vertical;
  title: string;
  category: PinCategory;
  description: string;
  schedule: string;
  pay_amount: number | string | null;
  pay_currency: string;
  contact_phone?: string | null;
  city: string;
  status: PinStatus;
  moderation_note?: string | null;
  boost_until: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  lat: number;
  lng: number;
  distance_m?: number;
  thumbnail_path?: string | null;
};

type ProfileRow = {
  id: string;
  phone: string | null;
  email?: string | null;
  display_name: string;
  avatar_url: string | null;
  default_mode: PinKind;
  vertical: Vertical;
  radius_km: number;
  rating_avg: number | string;
  rating_count: number;
  oblast: string;
  locale_override: 'uk' | 'en' | null;
  role: Profile['role'];
  plan: Profile['plan'];
  account_kind: Profile['accountKind'];
};

type MediaRow = {
  id: string;
  pin_id: string;
  kind: PinMedia['kind'];
  path: string;
  sort: number;
};

function requireClient(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new DataError('NO_SUPABASE', 'Supabase env is not set');
  return sb;
}

function mapSession(s: SbSession | null): Session | null {
  if (!s?.user) return null;
  return {
    userId: s.user.id,
    phone: s.user.phone ?? null,
    email: s.user.email ?? null,
  };
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email ?? null,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    defaultMode: row.default_mode,
    vertical: row.vertical,
    radiusKm: row.radius_km,
    lastGeog: null,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    oblast: row.oblast,
    localeOverride: row.locale_override,
    role: row.role,
    plan: row.plan,
    accountKind: row.account_kind,
  };
}

function mapPin(row: PinRow, media: PinMedia[] = []): Pin {
  return {
    id: row.id,
    authorId: row.author_id,
    kind: row.kind,
    vertical: row.vertical,
    title: row.title,
    category: row.category,
    description: row.description,
    schedule: row.schedule,
    payAmount: row.pay_amount == null ? null : Number(row.pay_amount),
    payCurrency: 'UAH',
    contactPhone: row.contact_phone ?? null,
    geog: { lat: Number(row.lat), lng: Number(row.lng) },
    city: row.city,
    status: row.status,
    moderationNote: row.moderation_note ?? null,
    boostUntil: row.boost_until,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    distanceM: row.distance_m == null ? undefined : Number(row.distance_m),
    thumbnailPath: row.thumbnail_path ?? media.find((m) => m.kind === 'photo')?.path ?? null,
    media,
  };
}

function mapMedia(row: MediaRow): PinMedia {
  return {
    id: row.id,
    pinId: row.pin_id,
    kind: row.kind,
    path: row.path,
    sort: row.sort,
  };
}

function wrapError(err: { message?: string; code?: string } | null, fallback: string): never {
  const message = err?.message ?? fallback;
  if (message.includes('PIN_QUOTA_EXCEEDED')) {
    throw new DataError('PIN_QUOTA_EXCEEDED', t('quotaExceeded'));
  }
  throw new DataError(err?.code ?? 'SUPABASE', message);
}

function emailRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return Linking.createURL('/');
}

async function loadMedia(sb: SupabaseClient, pinId: string): Promise<PinMedia[]> {
  const { data, error } = await sb
    .from('pin_media')
    .select('id, pin_id, kind, path, sort')
    .eq('pin_id', pinId)
    .order('sort');
  if (error) return [];
  return (data as MediaRow[] | null)?.map(mapMedia) ?? [];
}

function oppositeKind(kind: PinKind): PinKind {
  return kind === 'seek' ? 'offer' : 'seek';
}

export function createSupabaseApi(): DataApi {
  const sb = requireClient();

  return {
    backend: 'supabase',

    async getSession() {
      const { data } = await sb.auth.getSession();
      return mapSession(data.session);
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        cb(mapSession(session));
      });
      return () => data.subscription.unsubscribe();
    },

    async sendOtp(phone) {
      const { error } = await sb.auth.signInWithOtp({ phone });
      if (error) wrapError(error, 'Не вдалося надіслати код');
    },

    async verifyOtp(phone, code) {
      const { data, error } = await sb.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error || !data.session) wrapError(error, 'Невірний код');
      return mapSession(data.session)!;
    },

    async sendEmailOtp(email) {
      const normalized = normalizeEmail(email);
      if (!isValidEmail(normalized)) {
        throw new DataError('BAD_EMAIL', 'Некоректний email');
      }
      const { error } = await sb.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: emailRedirectTo(),
        },
      });
      if (error) wrapError(error, 'Не вдалося надіслати лист');
    },

    async verifyEmailOtp(email, code) {
      const normalized = normalizeEmail(email);
      const { data, error } = await sb.auth.verifyOtp({
        email: normalized,
        token: code,
        type: 'email',
      });
      if (error || !data.session) wrapError(error, 'Невірний код');
      return mapSession(data.session)!;
    },

    async signOut() {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (userId) {
        await sb.from('devices').delete().eq('user_id', userId);
      }
      await sb.auth.signOut();
    },

    async getProfile(userId) {
      const { data: sessionData } = await sb.auth.getSession();
      const id = userId ?? sessionData.session?.user.id;
      if (!id) return null;
      const { data, error } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
      if (error) wrapError(error, 'Профіль не знайдено');
      return data ? mapProfile(data as ProfileRow) : null;
    },

    async updateProfile(patch) {
      const { data: sessionData } = await sb.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const body: Record<string, unknown> = {};
      if (patch.displayName != null) body.display_name = patch.displayName;
      if (patch.radiusKm != null) body.radius_km = patch.radiusKm;
      if (patch.vertical != null) body.vertical = patch.vertical;
      if (patch.defaultMode != null) body.default_mode = patch.defaultMode;
      if (patch.lastGeog != null) {
        body.last_geog = {
          type: 'Point',
          coordinates: [patch.lastGeog.lng, patch.lastGeog.lat],
        };
      }
      const { data, error } = await sb.from('profiles').update(body).eq('id', id).select('*').single();
      if (error) wrapError(error, 'Не вдалося оновити профіль');
      return mapProfile(data as ProfileRow);
    },

    async listLivePins(filters) {
      const { data, error } = await sb.rpc('list_live_pins_nearby', {
        lat: filters.origin.lat,
        lng: filters.origin.lng,
        radius_km: filters.radiusKm,
        p_kind: oppositeKind(filters.kind),
        p_vertical: filters.vertical,
        p_search: filters.search.trim() || null,
      });
      if (error) wrapError(error, 'Не вдалося завантажити мітки');
      const rows = (data as PinRow[] | null) ?? [];
      return rows.map((row) => mapPin(row));
    },

    async getPin(id) {
      const { data: sessionData } = await sb.auth.getSession();
      // Anon has no table SELECT on pins — guests use pins_public (no contact_phone).
      const table = sessionData.session ? 'pins' : 'pins_public';
      const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
      if (error) wrapError(error, 'Мітку не знайдено');
      if (!data) return null;
      const media = await loadMedia(sb, id);
      return mapPin(data as PinRow, media);
    },

    async listMyPins() {
      const { data: sessionData } = await sb.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { data, error } = await sb
        .from('pins')
        .select('*')
        .eq('author_id', id)
        .order('created_at', { ascending: false });
      if (error) wrapError(error, 'Не вдалося завантажити мітки');
      const rows = (data as PinRow[] | null) ?? [];
      const result: Pin[] = [];
      for (const row of rows) {
        result.push(mapPin(row, await loadMedia(sb, row.id)));
      }
      return result;
    },

    async createPin(input) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { data, error } = await sb
        .from('pins')
        .insert({
          author_id: userId,
          kind: input.kind,
          vertical: input.vertical,
          title: input.title,
          category: input.category,
          description: input.description,
          schedule: input.schedule,
          pay_amount: input.payAmount,
          pay_currency: 'UAH',
          contact_phone: input.contactPhone,
          geog: { type: 'Point', coordinates: [input.geog.lng, input.geog.lat] },
          city: input.city,
          status: 'pending',
          boost_until: null,
        })
        .select('*')
        .single();
      if (error) wrapError(error, 'Не вдалося зберегти мітку');
      const pin = mapPin(data as PinRow);
      if (input.media?.length) {
        const { error: mediaError } = await sb.from('pin_media').insert(
          input.media.map((m, i) => ({
            pin_id: pin.id,
            kind: m.kind,
            path: m.path,
            sort: i,
          })),
        );
        if (mediaError) wrapError(mediaError, 'Не вдалося зберегти медіа');
        pin.media = await loadMedia(sb, pin.id);
      }
      return pin;
    },

    async updatePin(id, input) {
      const body: Record<string, unknown> = {};
      if (input.title != null) body.title = input.title;
      if (input.description != null) body.description = input.description;
      if (input.category != null) body.category = input.category;
      if (input.schedule != null) body.schedule = input.schedule;
      if (input.payAmount !== undefined) body.pay_amount = input.payAmount;
      if (input.contactPhone != null) body.contact_phone = input.contactPhone;
      if (input.city != null) body.city = input.city;
      if (input.kind != null) body.kind = input.kind;
      if (input.geog != null) {
        body.geog = { type: 'Point', coordinates: [input.geog.lng, input.geog.lat] };
      }
      if (input.status != null) body.status = input.status;
      const { data, error } = await sb.from('pins').update(body).eq('id', id).select('*').single();
      if (error) wrapError(error, 'Не вдалося оновити мітку');
      return mapPin(data as PinRow, await loadMedia(sb, id));
    },

    async getQuota() {
      const { data: sessionData } = await sb.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const [{ data: used, error: usedErr }, { data: limit, error: limitErr }, profile] = await Promise.all([
        sb.rpc('pins_created_this_month', { p_user_id: id }),
        sb.rpc('pin_monthly_quota', { p_user_id: id }),
        sb.from('profiles').select('plan').eq('id', id).maybeSingle(),
      ]);
      if (usedErr || limitErr) wrapError(usedErr ?? limitErr, 'Квота недоступна');
      return {
        used: Number(used ?? 0),
        limit: Number(limit ?? 3),
        plan: (profile.data?.plan as Profile['plan'] | undefined) ?? 'free',
      };
    },

    async replyToPin(pinId) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { error } = await sb.from('pin_replies').upsert(
        { pin_id: pinId, author_id: userId },
        { onConflict: 'pin_id,author_id' },
      );
      if (error) wrapError(error, 'Не вдалося відгукнутись');
      const { data, error: pinErr } = await sb.from('pins').select('contact_phone').eq('id', pinId).single();
      if (pinErr) wrapError(pinErr, 'Телефон недоступний');
      const phone = (data as { contact_phone?: string } | null)?.contact_phone;
      if (!phone) throw new DataError('NO_PHONE', t('needLogin'));
      return { contactPhone: phone };
    },

    async rate(pinId, toId, stars) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { error } = await sb.from('ratings').insert({
        from_id: userId,
        to_id: toId,
        pin_id: pinId,
        stars,
      });
      if (error) wrapError(error, 'Не вдалося оцінити');
    },

    async registerDevice(token) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { error } = await sb.from('devices').upsert(
        { user_id: userId, expo_push_token: token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,expo_push_token' },
      );
      if (error) wrapError(error, 'Не вдалося зберегти пристрій');
    },

    async unregisterDevice() {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      await sb.from('devices').delete().eq('user_id', userId);
    },

    async listModerationQueue() {
      const { data, error } = await sb
        .from('pins')
        .select('*')
        .in('status', ['pending', 'revision', 'rejected'])
        .order('created_at', { ascending: true });
      if (error) wrapError(error, 'Черга недоступна');
      return ((data as PinRow[] | null) ?? []).map((row) => mapPin(row));
    },

    async moderatePin(id, status, note) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { error } = await sb
        .from('pins')
        .update({
          status,
          moderation_note: note ?? null,
          moderated_by: userId,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) wrapError(error, 'Не вдалося змінити статус');
    },
  };
}
