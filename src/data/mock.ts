import AsyncStorage from '@react-native-async-storage/async-storage';

import { haversineMeters, isValidUaPhone, kyivMonthKey } from '@/src/geo';
import { t } from '@/src/i18n';
import { parseAuthCallbackUrl } from '@/src/lib/auth-callback';
import { isValidEmail, normalizeEmail } from '@/src/lib/email';

import { extendExpiresAt, isPinExpired, pinNeedsContinue } from './renewal';
import {
  DataError,
  type ChatMessage,
  type ChatThread,
  type DataApi,
  type Pin,
  type PinMedia,
  type Profile,
  type Session,
} from './types';

const STORAGE_KEY = 'socbizmap.mock.v12';
export const MOCK_OTP = '123456';

type MockState = {
  session: Session | null;
  pendingPhone: string | null;
  pendingEmail: string | null;
  profiles: Profile[];
  pins: Pin[];
  replies: { pinId: string; authorId: string }[];
  ratings: { fromId: string; toId: string; pinId: string; stars: number }[];
  devices: { userId: string; token: string }[];
  messages: ChatMessage[];
};

const empty: MockState = {
  session: null,
  pendingPhone: null,
  pendingEmail: null,
  profiles: [],
  pins: [],
  replies: [],
  ratings: [],
  devices: [],
  messages: [],
};

let mem: MockState = seed(structuredClone(empty));
const listeners = new Set<(s: Session | null) => void>();
const messageListeners = new Set<() => void>();
let loaded = false;
let loadPromise: Promise<void> | null = null;

function uid(): string {
  return `mock-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
}

function notifyMessages(): void {
  for (const cb of messageListeners) cb();
}

function seed(state: MockState): MockState {
  const employer: Profile = {
    id: 'mock-employer',
    phone: '+380501000001',
    email: null,
    displayName: 'ТОВ Приклад',
    avatarUrl: null,
    defaultMode: 'offer',
    vertical: 'work',
    radiusKm: 15,
    lastGeog: { lat: 49.9935, lng: 36.2304 },
    ratingAvg: 4.8,
    ratingCount: 12,
    oblast: 'Харківська',
    localeOverride: null,
    role: 'user',
    plan: 'free',
    accountKind: 'company',
  };
  const seeker: Profile = {
    id: 'mock-seeker',
    phone: '+380501000002',
    email: null,
    displayName: 'Олена',
    avatarUrl: null,
    defaultMode: 'seek',
    vertical: 'work',
    radiusKm: 10,
    lastGeog: { lat: 49.9935, lng: 36.2304 },
    ratingAvg: 5,
    ratingCount: 3,
    oblast: 'Харківська',
    localeOverride: null,
    role: 'user',
    plan: 'free',
    accountKind: 'person',
  };
  const master: Profile = {
    id: 'mock-master',
    phone: '+380501000003',
    email: null,
    displayName: 'Сергій',
    avatarUrl: null,
    defaultMode: 'offer',
    vertical: 'service',
    radiusKm: 20,
    lastGeog: { lat: 49.6883, lng: 36.3558 },
    ratingAvg: 4.6,
    ratingCount: 8,
    oblast: 'Харківська',
    localeOverride: null,
    role: 'user',
    plan: 'free',
    accountKind: 'fop',
  };
  const admin: Profile = {
    id: 'mock-admin',
    phone: '+380500000000',
    email: null,
    displayName: 'Модератор',
    avatarUrl: null,
    defaultMode: 'seek',
    vertical: 'work',
    radiusKm: 25,
    lastGeog: { lat: 49.9935, lng: 36.2304 },
    ratingAvg: 0,
    ratingCount: 0,
    oblast: 'Харківська',
    localeOverride: null,
    role: 'admin',
    plan: 'free',
    accountKind: 'person',
  };

  const media = (pinId: string, path: string): PinMedia[] => [
    { id: `${pinId}-m0`, pinId, kind: 'photo', path, sort: 0 },
  ];

  const pins: Pin[] = [
    {
      id: 'pin-kh-offer-work',
      authorId: employer.id,
      kind: 'offer',
      vertical: 'work',
      title: 'Муляр на обʼєкт у Харкові',
      category: 'construction',
      description: 'Цегла, 8-годинна зміна.',
      schedule: 'Пн–Пт 08:00–17:00',
      payAmount: 22000,
      payCurrency: 'UAH',
      contactPhone: '+380501000001',
      geog: { lat: 49.9935, lng: 36.2304 },
      city: 'Харків',
      status: 'live',
      moderationNote: null,
      boostUntil: null,
      expiresAt: daysFromNow(2),
      autoRenew: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      media: media('pin-kh-offer-work', ''),
    },
    {
      id: 'pin-kh-seek-work',
      authorId: seeker.id,
      kind: 'seek',
      vertical: 'work',
      title: 'Шукаю Junior QA',
      category: 'it',
      description: 'Ручне тестування, готова виходити.',
      schedule: 'Повний день',
      payAmount: 18000,
      payCurrency: 'UAH',
      contactPhone: '+380501000002',
      geog: { lat: 50.004, lng: 36.24 },
      city: 'Харків',
      status: 'live',
      moderationNote: null,
      boostUntil: null,
      expiresAt: daysFromNow(20),
      autoRenew: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      media: [],
    },
    {
      id: 'pin-zm-offer-service',
      authorId: master.id,
      kind: 'offer',
      vertical: 'service',
      title: 'Сантехнік, Зміїв',
      category: 'home',
      description: 'Заміна змішувачів, унітазів.',
      schedule: 'За домовленістю',
      payAmount: 800,
      payCurrency: 'UAH',
      contactPhone: '+380501000003',
      geog: { lat: 49.6883, lng: 36.3558 },
      city: 'Зміїв',
      status: 'live',
      moderationNote: null,
      boostUntil: null,
      expiresAt: daysFromNow(-1),
      autoRenew: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      media: media('pin-zm-offer-service', ''),
    },
    {
      id: 'pin-kh-offer-service',
      authorId: master.id,
      kind: 'offer',
      vertical: 'service',
      title: 'Сантехнік, Харків',
      category: 'home',
      description: 'Заміна змішувачів, унітазів.',
      schedule: 'За домовленістю',
      payAmount: 900,
      payCurrency: 'UAH',
      contactPhone: '+380501000003',
      geog: { lat: 49.991, lng: 36.235 },
      city: 'Харків',
      status: 'live',
      moderationNote: null,
      boostUntil: null,
      expiresAt: daysFromNow(10),
      autoRenew: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      media: media('pin-kh-offer-service', ''),
    },
    {
      id: 'pin-kh-seek-service',
      authorId: seeker.id,
      kind: 'seek',
      vertical: 'service',
      title: 'Потрібен кухар на весілля',
      category: 'horeca',
      description: 'Разова послуга, 40 осіб.',
      schedule: 'Вихідні',
      payAmount: 12000,
      payCurrency: 'UAH',
      contactPhone: '+380501000002',
      geog: { lat: 49.98, lng: 36.25 },
      city: 'Харків',
      status: 'live',
      moderationNote: null,
      boostUntil: null,
      expiresAt: daysFromNow(15),
      autoRenew: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      media: [],
    },
    {
      id: 'pin-pending-demo',
      authorId: employer.id,
      kind: 'offer',
      vertical: 'work',
      title: 'Касир (чернетка на модерації)',
      category: 'trade',
      description: 'Нова мітка, ще не на мапі.',
      schedule: 'Зміни',
      payAmount: 15000,
      payCurrency: 'UAH',
      contactPhone: '+380501000001',
      geog: { lat: 49.99, lng: 36.22 },
      city: 'Харків',
      status: 'pending',
      moderationNote: null,
      boostUntil: null,
      expiresAt: null,
      autoRenew: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      media: [],
    },
    {
      id: 'pin-kh-archived-work',
      authorId: employer.id,
      kind: 'offer',
      vertical: 'work',
      title: 'Водій (архів)',
      category: 'workers',
      description: 'Строк минув — в архіві.',
      schedule: 'Зміни',
      payAmount: 18000,
      payCurrency: 'UAH',
      contactPhone: '+380501000001',
      geog: { lat: 49.99, lng: 36.22 },
      city: 'Харків',
      status: 'archived',
      moderationNote: null,
      boostUntil: null,
      expiresAt: daysFromNow(-5),
      autoRenew: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      media: [],
    },
  ];

  state.profiles = [employer, seeker, master, admin];
  state.pins = pins;
  state.replies = [{ pinId: 'pin-kh-offer-work', authorId: seeker.id }];
  state.messages = [
    {
      id: 'msg-seed-1',
      pinId: 'pin-kh-offer-work',
      senderId: seeker.id,
      recipientId: employer.id,
      body: 'Доброго дня, ще актуальна вакансія муляра?',
      createdAt: daysFromNow(-1),
    },
    {
      id: 'msg-seed-2',
      pinId: 'pin-kh-offer-work',
      senderId: employer.id,
      recipientId: seeker.id,
      body: 'Так, виходьте завтра на 8:00, район центр.',
      createdAt: daysFromNow(-0.5),
    },
  ];
  return state;
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MockState;
          if (parsed?.pins?.length) {
            mem = parsed;
            mem.pendingEmail = mem.pendingEmail ?? null;
            mem.messages = mem.messages ?? [];
            mem.replies = mem.replies ?? [];
            mem.pins = (mem.pins ?? []).map((p) => ({
              ...p,
              autoRenew: p.autoRenew !== false,
            }));
            mem.profiles = (mem.profiles ?? []).map((p) => ({
              ...p,
              email: p.email ?? null,
            }));
            if (mem.session) {
              mem.session = {
                ...mem.session,
                email: mem.session.email ?? null,
              };
            }
          }
        }
      } catch {
        // keep seed
      }
      loaded = true;
    })();
  }
  await loadPromise;
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
}

function notify(): void {
  for (const cb of listeners) cb(mem.session);
}

function requireUser(): Session {
  if (!mem.session) throw new DataError('UNAUTHENTICATED', t('needLogin'));
  return mem.session;
}

function profileById(id: string): Profile | undefined {
  return mem.profiles.find((p) => p.id === id);
}

function withPhone(pin: Pin, viewer: Session | null): Pin {
  if (viewer) return { ...pin, media: [...pin.media] };
  return { ...pin, contactPhone: null, media: [...pin.media] };
}

function quotaFor(plan: Profile['plan']): number {
  return plan === 'pro' ? 30 : 3;
}

function usedThisMonth(authorId: string): number {
  const month = kyivMonthKey();
  return mem.pins.filter((p) => p.authorId === authorId && kyivMonthKey(new Date(p.createdAt)) === month).length;
}

function oppositeKind(kind: Pin['kind']): Pin['kind'] {
  return kind === 'seek' ? 'offer' : 'seek';
}

function archiveExpired(): number {
  let n = 0;
  for (const p of mem.pins) {
    if (isPinExpired(p)) {
      p.status = 'archived';
      p.updatedAt = nowIso();
      n += 1;
    }
  }
  return n;
}

function sameThread(m: ChatMessage, pinId: string, a: string, b: string): boolean {
  if (m.pinId !== pinId) return false;
  return (
    (m.senderId === a && m.recipientId === b) || (m.senderId === b && m.recipientId === a)
  );
}

function requireLivePin(pinId: string): Pin {
  const pin = mem.pins.find((p) => p.id === pinId);
  if (!pin) throw new DataError('NOT_FOUND', 'Мітку не знайдено');
  return pin;
}

function ensureReply(pinId: string, authorId: string): void {
  if (!mem.replies.some((r) => r.pinId === pinId && r.authorId === authorId)) {
    mem.replies.push({ pinId, authorId });
  }
}

function inPinThread(pin: Pin, me: string, other: string): boolean {
  if (me === other) return false;
  if (pin.authorId === me) {
    return mem.replies.some((r) => r.pinId === pin.id && r.authorId === other);
  }
  if (pin.authorId === other) {
    return mem.replies.some((r) => r.pinId === pin.id && r.authorId === me);
  }
  return false;
}

export function createMockApi(): DataApi {
  return {
    backend: 'mock',

    async getSession() {
      await ensureLoaded();
      return mem.session;
    },

    onAuthChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    async sendOtp(phone) {
      await ensureLoaded();
      if (!isValidUaPhone(phone)) {
        throw new DataError('BAD_PHONE', 'Телефон має бути +380XXXXXXXXX');
      }
      mem.pendingPhone = phone;
      await persist();
    },

    async verifyOtp(phone, code) {
      await ensureLoaded();
      if (code !== MOCK_OTP) throw new DataError('BAD_OTP', 'Невірний код');
      if (mem.pendingPhone && mem.pendingPhone !== phone) {
        throw new DataError('BAD_OTP', 'Спочатку надішліть код');
      }
      let profile = mem.profiles.find((p) => p.phone === phone);
      if (!profile) {
        profile = {
          id: uid(),
          phone,
          email: null,
          displayName: 'Користувач',
          avatarUrl: null,
          defaultMode: 'seek',
          vertical: 'work',
          radiusKm: 10,
          lastGeog: null,
          ratingAvg: 0,
          ratingCount: 0,
          oblast: 'Харківська',
          localeOverride: null,
          role: phone === '+380500000000' ? 'admin' : 'user',
          plan: 'free',
          accountKind: 'person',
        };
        mem.profiles.push(profile);
      }
      mem.session = { userId: profile.id, phone: profile.phone, email: profile.email };
      mem.pendingPhone = null;
      mem.pendingEmail = null;
      await persist();
      notify();
      return mem.session;
    },

    async sendEmailOtp(email) {
      await ensureLoaded();
      const normalized = normalizeEmail(email);
      if (!isValidEmail(normalized)) {
        throw new DataError('BAD_EMAIL', 'Некоректний email');
      }
      mem.pendingEmail = normalized;
      await persist();
    },

    async verifyEmailOtp(email, code) {
      await ensureLoaded();
      const normalized = normalizeEmail(email);
      if (code !== MOCK_OTP) throw new DataError('BAD_OTP', 'Невірний код');
      if (mem.pendingEmail && mem.pendingEmail !== normalized) {
        throw new DataError('BAD_OTP', 'Спочатку надішліть код');
      }
      let profile = mem.profiles.find((p) => p.email === normalized);
      if (!profile) {
        profile = {
          id: uid(),
          phone: null,
          email: normalized,
          displayName: normalized.split('@')[0] || 'Користувач',
          avatarUrl: null,
          defaultMode: 'seek',
          vertical: 'work',
          radiusKm: 10,
          lastGeog: null,
          ratingAvg: 0,
          ratingCount: 0,
          oblast: 'Харківська',
          localeOverride: null,
          role: 'user',
          plan: 'free',
          accountKind: 'person',
        };
        mem.profiles.push(profile);
      }
      mem.session = { userId: profile.id, phone: profile.phone, email: profile.email };
      mem.pendingEmail = null;
      mem.pendingPhone = null;
      await persist();
      notify();
      return mem.session;
    },

    async consumeAuthUrl(url) {
      await ensureLoaded();
      const params = parseAuthCallbackUrl(url);
      if (params.error || params.error_description) {
        throw new DataError(
          params.error ?? 'AUTH_CALLBACK',
          params.error_description ?? t('authCallbackError'),
        );
      }
      return mem.session;
    },

    async signOut() {
      await ensureLoaded();
      if (mem.session) {
        mem.devices = mem.devices.filter((d) => d.userId !== mem.session?.userId);
      }
      mem.session = null;
      await persist();
      notify();
    },

    async getProfile(userId) {
      await ensureLoaded();
      const id = userId ?? mem.session?.userId;
      if (!id) return null;
      return profileById(id) ?? null;
    },

    async updateProfile(patch) {
      await ensureLoaded();
      const s = requireUser();
      const p = profileById(s.userId);
      if (!p) throw new DataError('NOT_FOUND', 'Профіль не знайдено');
      Object.assign(p, {
        displayName: patch.displayName ?? p.displayName,
        radiusKm: patch.radiusKm ?? p.radiusKm,
        vertical: patch.vertical ?? p.vertical,
        defaultMode: patch.defaultMode ?? p.defaultMode,
        lastGeog: patch.lastGeog ?? p.lastGeog,
      });
      await persist();
      return { ...p };
    },

    async listLivePins(filters) {
      await ensureLoaded();
      archiveExpired();
      const radiusM = filters.radiusKm * 1000;
      const wanted = oppositeKind(filters.kind);
      return mem.pins
        .filter((p) => p.status === 'live')
        .filter((p) => p.kind === wanted)
        .filter((p) => p.vertical === filters.vertical)
        .filter((p) => {
          if (!filters.search.trim()) return true;
          const q = filters.search.trim().toLowerCase();
          return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        })
        .map((p) => {
          const distanceM = haversineMeters(filters.origin, p.geog);
          return { ...withPhone(p, mem.session), distanceM, thumbnailPath: p.media.find((m) => m.kind === 'photo')?.path ?? null };
        })
        .filter((p) => (p.distanceM ?? 0) <= radiusM)
        .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    },

    async getPin(id) {
      await ensureLoaded();
      archiveExpired();
      const pin = mem.pins.find((p) => p.id === id);
      if (!pin) return null;
      const s = mem.session;
      const me = s ? profileById(s.userId) : null;
      const canSee =
        pin.status === 'live' ||
        pin.authorId === s?.userId ||
        me?.role === 'admin';
      if (!canSee) return null;
      const distanceM = undefined;
      return { ...withPhone(pin, s), distanceM };
    },

    async listMyPins() {
      await ensureLoaded();
      const s = requireUser();
      if (archiveExpired()) await persist();
      return mem.pins
        .filter((p) => p.authorId === s.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((p) => ({ ...p, media: [...p.media] }));
    },

    async createPin(input) {
      await ensureLoaded();
      const s = requireUser();
      if (!isValidUaPhone(input.contactPhone)) {
        throw new DataError('BAD_PHONE', 'Телефон мітки має бути +380XXXXXXXXX');
      }
      const profile = profileById(s.userId);
      if (!profile) throw new DataError('NOT_FOUND', 'Профіль не знайдено');
      const used = usedThisMonth(s.userId);
      const limit = quotaFor(profile.plan);
      if (used >= limit) throw new DataError('PIN_QUOTA_EXCEEDED', t('quotaExceeded'));
      const id = uid();
      const pin: Pin = {
        id,
        authorId: s.userId,
        kind: input.kind,
        vertical: input.vertical,
        title: input.title,
        category: input.category,
        description: input.description,
        schedule: input.schedule,
        payAmount: input.payAmount,
        payCurrency: 'UAH',
        contactPhone: input.contactPhone,
        geog: input.geog,
        city: input.city,
        status: 'pending',
        moderationNote: null,
        boostUntil: null,
        expiresAt: null,
        autoRenew: input.autoRenew !== false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        media: (input.media ?? []).map((m, i) => ({
          id: `${id}-m${i}`,
          pinId: id,
          kind: m.kind,
          path: m.path,
          sort: i,
        })),
      };
      mem.pins.push(pin);
      await persist();
      return { ...pin, media: [...pin.media] };
    },

    async updatePin(id, input) {
      await ensureLoaded();
      const s = requireUser();
      const pin = mem.pins.find((p) => p.id === id);
      if (!pin || pin.authorId !== s.userId) throw new DataError('FORBIDDEN', 'Лише своя мітка');
      const before = { ...pin };
      if (input.title != null) pin.title = input.title;
      if (input.description != null) pin.description = input.description;
      if (input.category != null) pin.category = input.category;
      if (input.schedule != null) pin.schedule = input.schedule;
      if (input.payAmount !== undefined) pin.payAmount = input.payAmount;
      if (input.contactPhone != null) pin.contactPhone = input.contactPhone;
      if (input.geog != null) pin.geog = input.geog;
      if (input.city != null) pin.city = input.city;
      if (input.kind != null) pin.kind = input.kind;
      if (input.autoRenew != null) pin.autoRenew = input.autoRenew;
      if (input.status === 'closed' || input.status === 'hidden' || input.status === 'archived' || input.status === 'deleted') {
        pin.status = input.status;
      } else if (input.status === 'pending') {
        pin.status = 'pending';
      }
      const substantial =
        before.title !== pin.title ||
        before.description !== pin.description ||
        before.category !== pin.category ||
        before.schedule !== pin.schedule ||
        before.payAmount !== pin.payAmount ||
        before.contactPhone !== pin.contactPhone ||
        before.geog.lat !== pin.geog.lat ||
        before.geog.lng !== pin.geog.lng ||
        before.kind !== pin.kind;
      if (substantial && (before.status === 'live' || before.status === 'revision')) {
        pin.status = 'pending';
        pin.moderationNote = null;
      }
      pin.boostUntil = null;
      pin.updatedAt = nowIso();
      await persist();
      return { ...pin, media: [...pin.media] };
    },

    async getQuota() {
      await ensureLoaded();
      const s = requireUser();
      const profile = profileById(s.userId);
      const plan = profile?.plan ?? 'free';
      return { used: usedThisMonth(s.userId), limit: quotaFor(plan), plan };
    },

    async continuePin(id) {
      await ensureLoaded();
      const s = requireUser();
      const pin = mem.pins.find((p) => p.id === id);
      if (!pin || pin.authorId !== s.userId) throw new DataError('FORBIDDEN', 'Лише своя мітка');
      if (!pinNeedsContinue(pin)) {
        throw new DataError('PIN_CONTINUE_FORBIDDEN', t('continueForbidden'));
      }
      pin.expiresAt = extendExpiresAt(pin.expiresAt);
      pin.updatedAt = nowIso();
      await persist();
      return { ...pin, media: [...pin.media] };
    },

    async archiveExpiredPins() {
      await ensureLoaded();
      requireUser();
      const n = archiveExpired();
      if (n) await persist();
      return n;
    },

    async replyToPin(pinId) {
      await ensureLoaded();
      const s = requireUser();
      const pin = mem.pins.find((p) => p.id === pinId && p.status === 'live');
      if (!pin) throw new DataError('NOT_FOUND', 'Мітку не знайдено');
      if (pin.authorId === s.userId) throw new DataError('FORBIDDEN', 'Це ваша мітка');
      ensureReply(pinId, s.userId);
      await persist();
      return { contactPhone: pin.contactPhone ?? '' };
    },

    async openPinThread(pinId, peerId) {
      await ensureLoaded();
      const s = requireUser();
      const pin = requireLivePin(pinId);
      if (peerId) {
        if (!inPinThread(pin, s.userId, peerId)) {
          throw new DataError('FORBIDDEN', t('chatForbidden'));
        }
        return { pinId, peerId };
      }
      if (pin.authorId === s.userId) {
        throw new DataError('FORBIDDEN', t('pickThread'));
      }
      if (pin.status !== 'live' && pin.status !== 'archived') {
        throw new DataError('NOT_FOUND', 'Мітку не знайдено');
      }
      ensureReply(pinId, s.userId);
      await persist();
      return { pinId, peerId: pin.authorId };
    },

    async listThreads() {
      await ensureLoaded();
      const s = requireUser();
      const pairs = new Map<string, { pinId: string; peerId: string }>();
      for (const r of mem.replies) {
        const pin = mem.pins.find((p) => p.id === r.pinId);
        if (!pin) continue;
        if (r.authorId === s.userId) {
          pairs.set(`${r.pinId}:${pin.authorId}`, { pinId: r.pinId, peerId: pin.authorId });
        } else if (pin.authorId === s.userId) {
          pairs.set(`${r.pinId}:${r.authorId}`, { pinId: r.pinId, peerId: r.authorId });
        }
      }
      const threads: ChatThread[] = [];
      for (const { pinId, peerId } of pairs.values()) {
        const pin = mem.pins.find((p) => p.id === pinId);
        const peer = profileById(peerId);
        const last = mem.messages
          .filter((m) => sameThread(m, pinId, s.userId, peerId))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        threads.push({
          pinId,
          pinTitle: pin?.title ?? pinId,
          peerId,
          peerName: peer?.displayName ?? t('chatPeer'),
          lastBody: last?.body ?? null,
          lastAt: last?.createdAt ?? null,
        });
      }
      return threads.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
    },

    async listMessages(pinId, peerId) {
      await ensureLoaded();
      const s = requireUser();
      const pin = requireLivePin(pinId);
      if (!inPinThread(pin, s.userId, peerId)) {
        throw new DataError('FORBIDDEN', t('chatForbidden'));
      }
      return mem.messages
        .filter((m) => sameThread(m, pinId, s.userId, peerId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({ ...m }));
    },

    async sendMessage(pinId, peerId, body) {
      await ensureLoaded();
      const s = requireUser();
      const text = body.trim();
      if (!text) throw new DataError('BAD_BODY', t('chatEmptyBody'));
      if (text.length > 2000) throw new DataError('BAD_BODY', t('chatEmptyBody'));
      const pin = requireLivePin(pinId);
      if (pin.authorId !== s.userId && pin.authorId === peerId) {
        ensureReply(pinId, s.userId);
      }
      if (!inPinThread(pin, s.userId, peerId)) {
        throw new DataError('FORBIDDEN', t('chatForbidden'));
      }
      const msg: ChatMessage = {
        id: uid(),
        pinId,
        senderId: s.userId,
        recipientId: peerId,
        body: text,
        createdAt: nowIso(),
      };
      mem.messages.push(msg);
      await persist();
      notifyMessages();
      return { ...msg };
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
      const onChange = () => pull();
      messageListeners.add(onChange);
      return () => {
        cancelled = true;
        clearInterval(poll);
        messageListeners.delete(onChange);
      };
    },

    async rate(pinId, toId, stars) {
      await ensureLoaded();
      const s = requireUser();
      if (stars < 1 || stars > 5) throw new DataError('BAD_STARS', '1–5');
      if (toId === s.userId) throw new DataError('FORBIDDEN', 'Не можна оцінити себе');
      const exists = mem.ratings.find((r) => r.fromId === s.userId && r.toId === toId && r.pinId === pinId);
      if (exists) throw new DataError('EXISTS', 'Оцінка вже є');
      mem.ratings.push({ fromId: s.userId, toId, pinId, stars });
      const mine = mem.ratings.filter((r) => r.toId === toId);
      const p = profileById(toId);
      if (p) {
        p.ratingCount = mine.length;
        p.ratingAvg = mine.reduce((a, r) => a + r.stars, 0) / mine.length;
      }
      await persist();
    },

    async registerDevice(token) {
      await ensureLoaded();
      const s = requireUser();
      mem.devices = mem.devices.filter((d) => !(d.userId === s.userId && d.token === token));
      mem.devices.push({ userId: s.userId, token });
      await persist();
    },

    async unregisterDevice() {
      await ensureLoaded();
      if (!mem.session) return;
      mem.devices = mem.devices.filter((d) => d.userId !== mem.session?.userId);
      await persist();
    },

    async listModerationQueue() {
      await ensureLoaded();
      const s = requireUser();
      const me = profileById(s.userId);
      if (me?.role !== 'admin') throw new DataError('FORBIDDEN', 'Лише admin');
      return mem.pins
        .filter((p) => p.status === 'pending' || p.status === 'revision' || p.status === 'rejected')
        .map((p) => ({ ...p, media: [...p.media] }));
    },

    async moderatePin(id, status, note) {
      await ensureLoaded();
      const s = requireUser();
      const me = profileById(s.userId);
      if (me?.role !== 'admin') throw new DataError('FORBIDDEN', 'Лише admin');
      const pin = mem.pins.find((p) => p.id === id);
      if (!pin) throw new DataError('NOT_FOUND', 'Мітку не знайдено');
      pin.status = status;
      pin.moderationNote = note ?? null;
      pin.updatedAt = nowIso();
      if (status === 'live') {
        pin.expiresAt = daysFromNow(30);
        pin.autoRenew = pin.autoRenew !== false;
      }
      await persist();
    },
  };
}
