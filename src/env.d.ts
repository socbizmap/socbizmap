declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    /** Set to 1 to show email OTP / magic-link on the login screen. */
    EXPO_PUBLIC_AUTH_EMAIL?: string;
  }
}
