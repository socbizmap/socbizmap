import type { Pin } from './types';

export const RENEWAL_NOTICE_DAYS = 3;
export const RENEWAL_EXTEND_DAYS = 30;

const DAY_MS = 24 * 3600 * 1000;

export function pinExpiresAtMs(pin: Pin): number | null {
  if (!pin.expiresAt) return null;
  const ms = Date.parse(pin.expiresAt);
  return Number.isFinite(ms) ? ms : null;
}

/** Live pin with auto-renew, still before expiry, inside the 3-day notice window. */
export function pinNeedsContinue(pin: Pin, nowMs = Date.now()): boolean {
  if (pin.status !== 'live' || !pin.autoRenew) return false;
  const expires = pinExpiresAtMs(pin);
  if (expires == null || expires <= nowMs) return false;
  return expires - nowMs <= RENEWAL_NOTICE_DAYS * DAY_MS;
}

export function daysUntilExpiry(pin: Pin, nowMs = Date.now()): number | null {
  const expires = pinExpiresAtMs(pin);
  if (expires == null) return null;
  return Math.ceil((expires - nowMs) / DAY_MS);
}

export function extendExpiresAt(expiresAt: string | null, nowMs = Date.now()): string {
  const current = expiresAt ? Date.parse(expiresAt) : NaN;
  const base = Number.isFinite(current) ? Math.max(current, nowMs) : nowMs;
  return new Date(base + RENEWAL_EXTEND_DAYS * DAY_MS).toISOString();
}

export function isPinExpired(pin: Pin, nowMs = Date.now()): boolean {
  if (pin.status !== 'live') return false;
  const expires = pinExpiresAtMs(pin);
  return expires != null && expires < nowMs;
}

export function isCabinetActive(pin: Pin): boolean {
  return pin.status !== 'archived' && pin.status !== 'deleted';
}
