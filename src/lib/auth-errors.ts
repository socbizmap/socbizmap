import { t } from '@/src/i18n';

/** Map Supabase Auth's English rate-limit text to Ukrainian. Unknown errors stay unchanged. */
export function localizeAuthError(message?: string | null, code?: string | null): string | null {
  const blob = `${code ?? ''}\n${message ?? ''}`.toLowerCase();
  if (!blob.trim()) return null;
  if (
    blob.includes('over_email_send_rate_limit') ||
    blob.includes('email rate limit') ||
    (blob.includes('rate limit') && blob.includes('email'))
  ) {
    return t('emailRateLimit');
  }
  return null;
}
