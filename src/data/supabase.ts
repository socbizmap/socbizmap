import type { Session as SbSession, SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { t } from '@/src/i18n';
import { isAuthCallbackUrl, parseAuthCallbackUrl } from '@/src/lib/auth-callback';
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
      const pin = mapPin(data as PinRow);
      const viewer = sessionData.session?.user.id;
      if (isPinExpired(pin) && pin.authorId !== viewer) {
        return null;
      }
      const media = await loadMedia(sb, id);
      return mapPin(data as PinRow, media);
    },

    async listMyPins() {
      const { data: sessionData } = await sb.auth.getSession();
      const id = sessionData.session?.user.id;
      if (!id) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      await sb.rpc('archive_expired_pins');
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
          auto_renew: input.autoRenew !== false,
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
      if (input.autoRenew != null) body.auto_renew = input.autoRenew;
      const { data, error } = await sb.from('pins').update(body).eq('id', id).select('*').single();
      if (error) wrapError(error, 'Не вдалося оновити мітку');
      return mapPin(data as PinRow, await loadMedia(sb, id));
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

    async openPinThread(pinId, peerId) {
      const { data: sessionData } = await sb.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new DataError('UNAUTHENTICATED', t('needLogin'));
      const pin = await this.getPin(pinId);
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
      const pin = await this.getPin(pinId);
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
