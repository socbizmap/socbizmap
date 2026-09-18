/** Basic email check for the login field (not an RFC parser). */
export function isValidEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
