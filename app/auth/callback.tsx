import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { t } from '@/src/i18n';
import { localizeAuthError } from '@/src/lib/auth-errors';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

/** Landing path for Supabase ConfirmationURL (Free plan: link-only, no {{ .Token }}). */
export default function AuthCallbackScreen() {
  const { session, ready, authLinkError } = useData();
  const params = useLocalSearchParams<{
    error?: string;
    error_description?: string;
    error_code?: string;
  }>();
  const urlError =
    (typeof params.error_description === 'string' ? params.error_description : params.error_description?.[0]) ||
    (typeof params.error === 'string' ? params.error : params.error?.[0]) ||
    (typeof params.error_code === 'string' ? params.error_code : params.error_code?.[0]) ||
    null;
  const rawError = authLinkError ?? urlError;
  const localizedError = rawError ? localizeAuthError(rawError) : null;
  const displayError = localizedError ?? rawError;

  useEffect(() => {
    if (!ready) return;
    if (session && !displayError) router.replace('/start');
  }, [ready, session, displayError]);

  if (displayError) {
    return (
      <Screen>
        <Title>{t('login')}</Title>
        <Body style={styles.err}>{displayError}</Body>
        {localizedError ? null : <Muted>{t('authCallbackError')}</Muted>}
        <View style={styles.back}>
          <PrimaryButton label={t('login')} onPress={() => router.replace('/login')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t('authCallback')}</Title>
      <Muted style={styles.hint}>{t('emailLinkSent')}</Muted>
      {ready && !session ? (
        <View style={styles.back}>
          <PrimaryButton label={t('login')} onPress={() => router.replace('/login')} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: 12 },
  back: { marginTop: 24 },
  err: { color: colors.danger, marginTop: 12, marginBottom: 16 },
});
