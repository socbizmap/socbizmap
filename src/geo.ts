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

export type GeoPoint = { lat: number; lng: number };

export function inPilotOblast(lat: number, lng: number): boolean {
  return (
    lng >= PILOT_BBOX.minLng &&
    lng <= PILOT_BBOX.maxLng &&
    lat >= PILOT_BBOX.minLat &&
    lat <= PILOT_BBOX.maxLat
  );
}

export function isValidGeoPoint(p: { lat?: unknown; lng?: unknown } | null | undefined): p is GeoPoint {
  if (p == null || typeof p !== 'object') return false;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** PostgREST/PostGIS accept geography writes as EWKT, not GeoJSON. Longitude first. */
export function toEwktPoint(p: GeoPoint): string {
  if (!isValidGeoPoint(p)) {
    throw new Error('invalid geog');
  }
  return `SRID=4326;POINT(${p.lng} ${p.lat})`;
}

/** Parse PostgREST geography output (GeoJSON object/string or WKT/EWKT). */
export function parseGeography(value: unknown): GeoPoint | null {
  if (value == null) return null;
  if (typeof value === 'object') {
    const obj = value as {
      coordinates?: unknown;
      lat?: unknown;
      lng?: unknown;
      geometry?: { coordinates?: unknown };
    };
    const coords = obj.coordinates ?? obj.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const point = { lng: Number(coords[0]), lat: Number(coords[1]) };
      return isValidGeoPoint(point) ? point : null;
    }
    const direct = { lat: Number(obj.lat), lng: Number(obj.lng) };
    if (isValidGeoPoint(direct)) return direct;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{')) {
      try {
        return parseGeography(JSON.parse(trimmed) as unknown);
      } catch {
        // not JSON
      }
    }
    const m = trimmed.match(/POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)/i);
    if (m) {
      const point = { lng: Number(m[1]), lat: Number(m[2]) };
      return isValidGeoPoint(point) ? point : null;
    }
  }
  return null;
}

export function formatGeoPoint(p: GeoPoint): string {
  return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
}

export function projectToPilot(
  lat: number,
  lng: number,
): { x: number; y: number } {
  const x = (lng - PILOT_BBOX.minLng) / (PILOT_BBOX.maxLng - PILOT_BBOX.minLng);
  const y = (PILOT_BBOX.maxLat - lat) / (PILOT_BBOX.maxLat - PILOT_BBOX.minLat);
  return { x: clamp01(x), y: clamp01(y) };
}

export function unprojectFromPilot(x: number, y: number): GeoPoint {
  const lng = PILOT_BBOX.minLng + clamp01(x) * (PILOT_BBOX.maxLng - PILOT_BBOX.minLng);
  const lat = PILOT_BBOX.maxLat - clamp01(y) * (PILOT_BBOX.maxLat - PILOT_BBOX.minLat);
  return { lat, lng };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function isValidUaPhone(phone: string): boolean {
  return /^\+380[0-9]{9}$/.test(phone);
}

export function normalizeUaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('380') && digits.length >= 12) return `+380${digits.slice(3, 12)}`;
  if (digits.startsWith('0') && digits.length >= 10) return `+380${digits.slice(1, 10)}`;
  if (digits.length === 9) return `+380${digits}`;
  if (raw.trim().startsWith('+380') && digits.length >= 9) return `+380${digits.slice(-9)}`;
  return raw.trim().startsWith('+') ? `+${digits}` : digits ? `+${digits}` : raw.trim();
}

/** National 9 digits for the create/edit phone field (`+380` prefix is shown separately). */
export function uaPhoneNationalDigits(raw: string | null | undefined): string {
  if (!raw) return '';
  const normalized = normalizeUaPhone(raw);
  if (isValidUaPhone(normalized)) return normalized.slice(4);
  return raw.replace(/\D/g, '').replace(/^380/, '').slice(0, 9);
}
