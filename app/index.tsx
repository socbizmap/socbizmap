import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, GhostButton, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function SplashScreen() {
  const { backend, session, ready } = useData();

  useEffect(() => {
    if (ready && session) router.replace('/start');
  }, [ready, session]);

  return (
    <Screen style={styles.wrap}>
      <View style={styles.hero}>
        <Title style={styles.logo}>{t('appName')}</Title>
        <Muted>{t('tm')}</Muted>
        <Muted style={styles.op}>{t('operator')}</Muted>
      </View>
      <View style={styles.actions}>
        <Muted>
          {backend === 'supabase' ? t('backendLive') : t('backendMock')}
        </Muted>
        <PrimaryButton label={t('login')} onPress={() => router.push('/login')} />
        <GhostButton label={t('register')} onPress={() => router.push('/login?mode=register')} />
        <GhostButton label={t('guestMap')} onPress={() => router.push('/start')} />
      </View>
      <Body style={styles.note}>{t('tm')}</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between', backgroundColor: colors.primarySoft },
  hero: { marginTop: 80, gap: 8 },
  logo: { fontSize: 36, color: colors.primaryDark },
  op: { marginTop: 4 },
  actions: { gap: 12, marginBottom: 24 },
  note: { textAlign: 'center', color: colors.muted, fontSize: 12 },
});
