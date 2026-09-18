/**
 * Live email OTP / magic-link is shown when:
 * - EXPO_PUBLIC_AUTH_EMAIL=1 (or true/yes), or
 * - the login screen turns it on after a failed SMS send.
 */
export function isEmailAuthFlagEnabled(): boolean {
  const v = (process.env.EXPO_PUBLIC_AUTH_EMAIL ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}
