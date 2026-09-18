import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

/** Landing path for Supabase ConfirmationURL (Free plan: link-only, no {{ .Token }}). */
export default function AuthCallbackScreen() {
  const { session, ready, authLinkError } = useData();

  useEffect(() => {
    if (!ready) return;
    if (session) router.replace('/start');
  }, [ready, session]);

  if (authLinkError) {
    return (
      <Screen>
        <Title>{t('login')}</Title>
        <Body style={styles.err}>{authLinkError}</Body>
        <PrimaryButton label={t('login')} onPress={() => router.replace('/login')} />
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
