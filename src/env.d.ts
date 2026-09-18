declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    /** Set to 1 to show email magic-link on the login screen. */
    EXPO_PUBLIC_AUTH_EMAIL?: string;
    /**
     * Set to 1 only when Auth email templates include {{ .Token }}
     * (custom SMTP or Pro). Free plan is magic-link only.
     */
    EXPO_PUBLIC_AUTH_EMAIL_OTP?: string;
  }
}
