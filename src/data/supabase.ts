import type { Session as SbSession, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { isValidGeoPoint, isValidUaPhone, normalizeUaPhone, parseGeography, toEwktPoint } from '@/src/geo';
import { t } from '@/src/i18n';
import { isAuthCallbackUrl, parseAuthCallbackUrl } from '@/src/lib/auth-callback';
import { localizeAuthError } from '@/src/lib/auth-errors';
import { isValidEmail, normalizeEmail } from '@/src/lib/email';
import { getSupabase } from '@/src/lib/supabase';

import { isPinExpired } from './renewal';
import {
  DataError,
  type ChatMessage,
  type ChatThread,
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
  auto_renew?: boolean;
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
  last_geog?: unknown;
};

type MediaRow = {
  id: string;
  pin_id: string;
  kind: PinMedia['kind'];
  path: string;
  sort: number;
};

type MessageRow = {
  id: string;
  pin_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

type ReplyRow = {
  pin_id: string;
  author_id: string;
};

/**
 * Every `pins` column the client needs except `contact_phone`. Signed-in users have no
 * column SELECT on `contact_phone`; it is read through the `get_pin_contact` RPC.
 */
const PIN_COLUMNS =
  'id, author_id, kind, vertical, title, category, description, schedule, pay_amount, pay_currency, city, status, moderation_note, boost_until, expires_at, auto_renew, created_at, updated_at, lat, lng';

/** Profile columns any signed-in user may read about other users. */
const PUBLIC_PROFILE_COLUMNS = 'id, display_name, avatar_url, rating_avg, rating_count, account_kind';

type PublicProfileRow = Pick<
  ProfileRow,
  'id' | 'display_name' | 'avatar_url' | 'rating_avg' | 'rating_count' | 'account_kind'
>;

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
    lastGeog: parseGeography(row.last_geog),
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    oblast: row.oblast,
    localeOverride: row.locale_override,
    role: row.role,
    plan: row.plan,
    accountKind: row.account_kind,
  };
}

/** Another user's profile: only public columns are readable, private fields stay empty. */
function mapPublicProfile(row: PublicProfileRow): Profile {
  return {
    id: row.id,
    phone: null,
    email: null,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    defaultMode: 'seek',
    vertical: 'work',
    radiusKm: 10,
    lastGeog: null,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    oblast: '',
    localeOverride: null,
    role: 'user',
    plan: 'free',
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
    autoRenew: row.auto_renew !== false,
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

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    pinId: row.pin_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function sameThread(row: MessageRow, pinId: string, a: string, b: string): boolean {
  if (row.pin_id !== pinId) return false;
  return (
    (row.sender_id === a && row.recipient_id === b) ||
    (row.sender_id === b && row.recipient_id === a)
  );
}

function wrapError(err: { message?: string; code?: string } | null, fallback: string): never {
  const message = err?.message ?? fallback;
  if (message.includes('PIN_QUOTA_EXCEEDED')) {
    throw new DataError('PIN_QUOTA_EXCEEDED', t('quotaExceeded'));
  }
  if (message.includes('PIN_CONTINUE_FORBIDDEN')) {
    throw new DataError('PIN_CONTINUE_FORBIDDEN', t('continueForbidden'));
  }
  const localized = localizeAuthError(message, err?.code);
  if (localized) throw new DataError(err?.code ?? 'EMAIL_RATE_LIMIT', localized);
  throw new DataError(err?.code ?? 'SUPABASE', message);
}

function emailRedirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }
  return Linking.createURL('/auth/callback');
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

/** Caller's own full profile row (email, phone, last_geog, role, plan) via RPC. */
async function loadOwnProfile(sb: SupabaseClient): Promise<Profile | null> {
  const { data, error } = await sb.rpc('get_my_profile').maybeSingle();
  if (error) wrapError(error, 'Профіль не знайдено');
  return data ? mapProfile(data as ProfileRow) : null;
}

/**
 * Contact phone of a pin: always for its author and admins, for a live pin otherwise
 * (server logs the reveal and caps distinct pins per day). Null when not allowed.
 */
async function loadPinContact(sb: SupabaseClient, pinId: string): Promise<string | null> {
  const { data, error } = await sb.rpc('get_pin_contact', { p_pin_id: pinId });
  if (error) return null;
  return typeof data === 'string' && data ? data : null;
}

/**
 * One pin. Guests read `pins_public` (no phone). Signed-in users read `pins` without
 * `contact_phone`; `withContact` adds the phone through `get_pin_contact`.
 */
async function loadPin(sb: SupabaseClient, id: string, withContact: boolean): Promise<Pin | null> {
  const { data: sessionData } = await sb.auth.getSession();
  const viewer = sessionData.session?.user.id;
  // Anon has no table SELECT on pins — guests use pins_public (no contact_phone).
  const { data, error } = viewer
    ? await sb.from('pins').select(PIN_COLUMNS).eq('id', id).maybeSingle()
    : await sb.from('pins_public').select('*').eq('id', id).maybeSingle();
  if (error) wrapError(error, 'Мітку не знайдено');
  if (!data) return null;
  const row = data as PinRow;
  const pin = mapPin(row);
  if (isPinExpired(pin) && pin.authorId !== viewer) {
    return null;
  }
  if (viewer && withContact) {
    row.contact_phone = await loadPinContact(sb, id);
  }
  const media = await loadMedia(sb, id);
  return mapPin(row, media);
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

    async consumeAuthUrl(url) {
      if (!isAuthCallbackUrl(url)) return mapSession((await sb.auth.getSession()).data.session);
      const params = parseAuthCallbackUrl(url);
      if (params.error || params.error_description) {
        throw new DataError(
          params.error ?? 'AUTH_CALLBACK',
          params.error_description ?? t('authCallbackError'),
        );
      }
      if (params.code) {
        const { data, error } = await sb.auth.exchangeCodeForSession(params.code);
        if (error || !data.session) wrapError(error, t('authCallbackError'));
        return mapSession(data.session)!;
      }
      if (params.access_token && params.refresh_token) {
        const { data, error } = await sb.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error || !data.session) wrapError(error, t('authCallbackError'));
        return mapSession(data.session)!;
      }
      const { data } = await sb.auth.getSession();
      return mapSession(data.session);
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
      const me = sessionData.session?.user.id;
      const id = userId ?? me;
      if (!id) return null;
      if (id === me) return loadOwnProfile(sb);
      // Profiles are readable only when signed in, and only public columns of other users.
      if (!me) return null;
      const { data, error } = await sb
        .from('profiles')
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) wrapError(error, 'Профіль не знайдено');
      return data ? mapPublicProfile(data as PublicProfileRow) : null;
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
        if (!isValidGeoPoint(patch.lastGeog)) {
          throw new DataError('BAD_GEOG', t('locationMissing'));
        }
        body.last_geog = toEwktPoint(patch.lastGeog);
      }
      const { error } = await sb.from('profiles').update(body).eq('id', id);
      if (error) wrapError(error, 'Не вдалося оновити профіль');
      const profile = await loadOwnProfile(sb);
      if (!profile) throw new DataError('NOT_FOUND', 'Профіль не знайдено');
      return profile;
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
      return loadPin(sb, id, true);
    },

    async listMyPins() {
      const { data: sessionData } = await sb.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      await sb.rpc('archive_expired_pins');
      const { data, error } = await sb
        .from('pins')
        .select(PIN_COLUMNS)
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
      const contactPhone = normalizeUaPhone(input.contactPhone);
      if (!isValidUaPhone(contactPhone)) {
        throw new DataError('BAD_PHONE', 'Телефон мітки: +380 і 9 цифр');
      }
      if (!isValidGeoPoint(input.geog)) {
        throw new DataError('BAD_GEOG', t('locationMissing'));
      }
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
          contact_phone: contactPhone,
          geog: toEwktPoint(input.geog),
          city: input.city,
          status: 'pending',
          boost_until: null,
          auto_renew: input.autoRenew !== false,
        })
        .select(PIN_COLUMNS)
        .single();
      if (error) wrapError(error, 'Не вдалося зберегти мітку');
      const pin = mapPin({ ...(data as PinRow), contact_phone: contactPhone });
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
      if (input.contactPhone != null) {
        const contactPhone = normalizeUaPhone(input.contactPhone);
        if (!isValidUaPhone(contactPhone)) {
          throw new DataError('BAD_PHONE', 'Телефон мітки: +380 і 9 цифр');
        }
        body.contact_phone = contactPhone;
      }
      if (input.city != null) body.city = input.city;
      if (input.kind != null) body.kind = input.kind;
      if (input.geog != null) {
        if (!isValidGeoPoint(input.geog)) {
          throw new DataError('BAD_GEOG', t('locationMissing'));
        }
        body.geog = toEwktPoint(input.geog);
      }
      if (input.status != null) body.status = input.status;
      if (input.autoRenew != null) body.auto_renew = input.autoRenew;
      const { data, error } = await sb.from('pins').update(body).eq('id', id).select(PIN_COLUMNS).single();
      if (error) wrapError(error, 'Не вдалося оновити мітку');
      const row = data as PinRow;
      row.contact_phone =
        typeof body.contact_phone === 'string' ? body.contact_phone : await loadPinContact(sb, id);
      return mapPin(row, await loadMedia(sb, id));
    },

    async continuePin(id) {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session?.user.id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { data, error } = await sb.rpc('continue_pin', { p_pin_id: id });
      if (error) wrapError(error, t('continueForbidden'));
      const row = (Array.isArray(data) ? data[0] : data) as PinRow | null;
      if (!row) throw new DataError('PIN_CONTINUE_FORBIDDEN', t('continueForbidden'));
      return mapPin(row, await loadMedia(sb, id));
    },

    async archiveExpiredPins() {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session?.user.id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { data, error } = await sb.rpc('archive_expired_pins');
      if (error) wrapError(error, 'Не вдалося архівувати');
      return Number(data ?? 0);
    },

    async getQuota() {
      const { data: sessionData } = await sb.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const [{ data: used, error: usedErr }, { data: limit, error: limitErr }, profile] = await Promise.all([
        sb.rpc('pins_created_this_month', { p_user_id: id }),
        sb.rpc('pin_monthly_quota', { p_user_id: id }),
        sb.rpc('get_my_profile').maybeSingle(),
      ]);
      if (usedErr || limitErr) wrapError(usedErr ?? limitErr, 'Квота недоступна');
      return {
        used: Number(used ?? 0),
        limit: Number(limit ?? 3),
        plan: ((profile.data as ProfileRow | null)?.plan as Profile['plan'] | undefined) ?? 'free',
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
      const { data, error: pinErr } = await sb.rpc('get_pin_contact', { p_pin_id: pinId });
      if (pinErr) wrapError(pinErr, 'Телефон недоступний');
      const phone = typeof data === 'string' ? data : null;
      if (!phone) throw new DataError('NO_PHONE', t('needLogin'));
      return { contactPhone: phone };
    },

    async openPinThread(pinId, peerId) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const pin = await loadPin(sb, pinId, false);
      if (!pin) throw new DataError('NOT_FOUND', 'Мітку не знайдено');
      if (peerId) {
        if (peerId === userId) throw new DataError('FORBIDDEN', t('chatForbidden'));
        const isAuthor = pin.authorId === userId;
        const { data: reply, error } = await sb
          .from('pin_replies')
          .select('pin_id, author_id')
          .eq('pin_id', pinId)
          .eq('author_id', isAuthor ? peerId : userId)
          .maybeSingle();
        if (error) wrapError(error, t('chatForbidden'));
        if (!reply) throw new DataError('FORBIDDEN', t('chatForbidden'));
        if (!isAuthor && pin.authorId !== peerId) {
          throw new DataError('FORBIDDEN', t('chatForbidden'));
        }
        return { pinId, peerId };
      }
      if (pin.authorId === userId) {
        throw new DataError('FORBIDDEN', t('pickThread'));
      }
      const { error } = await sb.from('pin_replies').upsert(
        { pin_id: pinId, author_id: userId },
        { onConflict: 'pin_id,author_id' },
      );
      if (error) wrapError(error, t('chatForbidden'));
      return { pinId, peerId: pin.authorId };
    },

    async listThreads() {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));

      const { data: replyRows, error: replyErr } = await sb
        .from('pin_replies')
        .select('pin_id, author_id');
      if (replyErr) wrapError(replyErr, 'Не вдалося завантажити чати');
      const replies = (replyRows as ReplyRow[] | null) ?? [];
      const pinIds = [...new Set(replies.map((r) => r.pin_id))];
      if (pinIds.length === 0) return [];

      const [{ data: pinRows, error: pinErr }, { data: msgRows, error: msgErr }] = await Promise.all([
        sb.from('pins').select('id, title, author_id').in('id', pinIds),
        sb
          .from('messages')
          .select('id, pin_id, sender_id, recipient_id, body, created_at')
          .in('pin_id', pinIds)
          .order('created_at', { ascending: false })
          .limit(400),
      ]);
      if (pinErr) wrapError(pinErr, 'Не вдалося завантажити чати');
      if (msgErr) wrapError(msgErr, 'Не вдалося завантажити чати');

      const pins = new Map(
        ((pinRows as { id: string; title: string; author_id: string }[] | null) ?? []).map((p) => [
          p.id,
          p,
        ]),
      );
      const messages = (msgRows as MessageRow[] | null) ?? [];
      const pairs = new Map<string, { pinId: string; peerId: string }>();
      for (const r of replies) {
        const pin = pins.get(r.pin_id);
        if (!pin) continue;
        if (r.author_id === userId) {
          pairs.set(`${r.pin_id}:${pin.author_id}`, { pinId: r.pin_id, peerId: pin.author_id });
        } else if (pin.author_id === userId) {
          pairs.set(`${r.pin_id}:${r.author_id}`, { pinId: r.pin_id, peerId: r.author_id });
        }
      }

      const peerIds = [...new Set([...pairs.values()].map((p) => p.peerId))];
      const { data: profileRows } = peerIds.length
        ? await sb.from('profiles').select('id, display_name').in('id', peerIds)
        : { data: [] as { id: string; display_name: string }[] };
      const names = new Map(
        ((profileRows as { id: string; display_name: string }[] | null) ?? []).map((p) => [
          p.id,
          p.display_name,
        ]),
      );

      const threads: ChatThread[] = [];
      for (const { pinId, peerId } of pairs.values()) {
        const pin = pins.get(pinId);
        const last = messages.find((m) => sameThread(m, pinId, userId, peerId));
        threads.push({
          pinId,
          pinTitle: pin?.title ?? pinId,
          peerId,
          peerName: names.get(peerId) ?? t('chatPeer'),
          lastBody: last?.body ?? null,
          lastAt: last?.created_at ?? null,
        });
      }
      return threads.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    },

    async listMessages(pinId, peerId) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const { data, error } = await sb
        .from('messages')
        .select('id, pin_id, sender_id, recipient_id, body, created_at')
        .eq('pin_id', pinId)
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`,
        )
        .order('created_at', { ascending: true });
      if (error) wrapError(error, 'Не вдалося завантажити повідомлення');
      return ((data as MessageRow[] | null) ?? []).map(mapMessage);
    },

    async sendMessage(pinId, peerId, body) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const text = body.trim();
      if (!text) throw new DataError('BAD_BODY', t('chatEmptyBody'));
      const pin = await loadPin(sb, pinId, false);
      if (!pin) throw new DataError('NOT_FOUND', 'Мітку не знайдено');
      if (pin.authorId !== userId && pin.authorId === peerId) {
        const { error: replyErr } = await sb.from('pin_replies').upsert(
          { pin_id: pinId, author_id: userId },
          { onConflict: 'pin_id,author_id' },
        );
        if (replyErr) wrapError(replyErr, t('chatForbidden'));
      }
      const { data, error } = await sb
        .from('messages')
        .insert({
          pin_id: pinId,
          sender_id: userId,
          recipient_id: peerId,
          body: text,
        })
        .select('id, pin_id, sender_id, recipient_id, body, created_at')
        .single();
      if (error) wrapError(error, t('chatForbidden'));
      return mapMessage(data as MessageRow);
    },

    subscribeMessages(pinId, peerId, cb) {
      let cancelled = false;
      const pull = () => {
        if (cancelled) return;
        void this.listMessages(pinId, peerId).then((rows) => {
          if (!cancelled) cb(rows);
        });
      };
      pull();
      const poll = setInterval(pull, 4000);
      const channel = sb
        .channel(`chat:${pinId}:${[pinId, peerId].sort().join(':')}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `pin_id=eq.${pinId}` },
          () => pull(),
        )
        .subscribe();
      return () => {
        cancelled = true;
        clearInterval(poll);
        void sb.removeChannel(channel);
      };
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
        .select(PIN_COLUMNS)
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
