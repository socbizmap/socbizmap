/** Parse Supabase magic-link / PKCE redirects from web, Expo, or custom scheme URLs. */
export type AuthCallbackParams = {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
  type?: string;
};

function readParams(raw: string): URLSearchParams {
  const params = new URLSearchParams();
  const trimmed = raw.replace(/^[?#]/, '');
  if (!trimmed) return params;
  new URLSearchParams(trimmed).forEach((value, key) => {
    if (value) params.set(key, value);
  });
  return params;
}

export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  let search = '';
  let hash = '';
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  if (queryAt >= 0) {
    search = url.slice(queryAt + 1, hashAt >= 0 && hashAt > queryAt ? hashAt : undefined);
  }
  if (hashAt >= 0) {
    hash = url.slice(hashAt + 1);
  }
  const params = readParams(search);
  readParams(hash).forEach((value, key) => {
    if (!params.get(key)) params.set(key, value);
  });
  const pick = (key: string) => params.get(key) || undefined;
  return {
    code: pick('code'),
    access_token: pick('access_token'),
    refresh_token: pick('refresh_token'),
    error: pick('error'),
    error_description: pick('error_description') ?? pick('error_code'),
    type: pick('type'),
  };
}

export function isAuthCallbackUrl(url: string): boolean {
  const p = parseAuthCallbackUrl(url);
  return Boolean(p.code || (p.access_token && p.refresh_token) || p.error || p.error_description);
}
