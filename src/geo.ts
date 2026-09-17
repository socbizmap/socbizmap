export const KHARKIV: { lat: number; lng: number } = { lat: 49.9935, lng: 36.2304 };
export const ZMIIV: { lat: number; lng: number } = { lat: 49.6883, lng: 36.3558 };

/** Approximate Харківська область bbox used by SQL `in_pilot_oblast`. */
export const PILOT_BBOX = {
  minLng: 34.85,
  minLat: 48.52,
  maxLng: 38.1,
  maxLat: 50.46,
} as const;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatKm(meters: number): string {
  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)} км`;
  return `${Math.round(km)} км`;
}

export function formatPay(amount: number | null | undefined): string | null {
  if (amount == null) return null;
  return `${Math.round(amount).toLocaleString('uk-UA')} ₴`;
}

export function kyivMonthKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  return `${year}-${month}`;
}

export function projectToPilot(
  lat: number,
  lng: number,
): { x: number; y: number } {
  const x = (lng - PILOT_BBOX.minLng) / (PILOT_BBOX.maxLng - PILOT_BBOX.minLng);
  const y = (PILOT_BBOX.maxLat - lat) / (PILOT_BBOX.maxLat - PILOT_BBOX.minLat);
  return { x: clamp01(x), y: clamp01(y) };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function isValidUaPhone(phone: string): boolean {
  return /^\+380[0-9]{9}$/.test(phone);
}

export function normalizeUaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('380') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+38${digits}`;
  if (digits.length === 9) return `+380${digits}`;
  if (raw.startsWith('+380')) return `+380${digits.slice(-9)}`;
  return raw.startsWith('+') ? raw : `+${digits}`;
}
