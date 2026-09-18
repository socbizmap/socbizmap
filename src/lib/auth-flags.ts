function envFlag(name: 'EXPO_PUBLIC_AUTH_EMAIL' | 'EXPO_PUBLIC_AUTH_EMAIL_OTP'): boolean {
  const v = (process.env[name] ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Live email sign-in is shown when:
 * - EXPO_PUBLIC_AUTH_EMAIL=1 (or true/yes), or
 * - the login screen turns it on after a failed SMS send.
 */
export function isEmailAuthFlagEnabled(): boolean {
  return envFlag('EXPO_PUBLIC_AUTH_EMAIL');
}

/**
 * 6-digit email OTP field. Live Supabase Free templates are ConfirmationURL-only
 * (no {{ .Token }}), so this stays off unless custom SMTP / Pro is configured
 * and EXPO_PUBLIC_AUTH_EMAIL_OTP=1. Mock always uses the digit field.
 */
export function isEmailOtpUiEnabled(backend: 'mock' | 'supabase'): boolean {
  if (backend === 'mock') return true;
  return envFlag('EXPO_PUBLIC_AUTH_EMAIL_OTP');
}
