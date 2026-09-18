import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PinRow } from '@/src/components/PinRow';
import { Chip, GhostButton, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import type { Pin, Quota } from '@/src/data/types';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function ProfileScreen() {
  const { api, session, profile, backend } = useData();
  const [pins, setPins] = useState<Pin[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }
    void api.listMyPins().then(setPins);
    void api.getQuota().then(setQuota);
  }, [api, session]);

  async function logout() {
    await api.unregisterDevice();
    await api.signOut();
    router.replace('/');
  }

  if (!profile) {
    return (
      <Screen>
        <Muted>…</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <Title>{profile.displayName}</Title>
        <Muted>{profile.phone}</Muted>
        <Muted>
          ★ {profile.ratingAvg.toFixed(1)} ({profile.ratingCount}) · радіус {profile.radiusKm} км
        </Muted>
        <Muted style={styles.backend}>
          {backend === 'supabase' ? t('backendLive') : t('backendMock')}
        </Muted>
        {quota ? (
          <Text style={styles.quota}>
            {t('quota')}: {quota.used} з {quota.limit} ({quota.plan === 'pro' ? 'PRO' : 'free'})
          </Text>
        ) : null}
        <View style={styles.row}>
          <Chip label={`${t('pro')} · ${t('soon')}`} />
        </View>
        <Muted>{t('language')}</Muted>
        <Chip label={t('englishSoon')} />
        {profile.role === 'admin' ? (
          <PrimaryButton label={t('adminQueue')} onPress={() => router.push('/admin')} />
        ) : null}
        <Text style={styles.h}>{t('myPins')}</Text>
        {pins.map((p) => (
          <View key={p.id}>
            <PinRow pin={p} showStatus onPress={() => router.push(`/pin/${p.id}`)} />
            <View style={styles.pinActions}>
              <Pressable onPress={() => router.push(`/create?id=${p.id}`)}>
                <Text style={styles.link}>✎ {t('edit')}</Text>
              </Pressable>
              {p.status === 'live' ? (
                <Text style={styles.soon}>{t('highlight')} · {t('soon')}</Text>
              ) : null}
            </View>
          </View>
        ))}
        <GhostButton label={t('logout')} onPress={() => void logout()} />
        <Muted style={styles.tm}>{t('tm')}</Muted>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backend: { marginTop: 8 },
  quota: { marginVertical: 12, fontWeight: '700', color: colors.text },
  row: { marginBottom: 12 },
  h: { fontSize: 18, fontWeight: '700', color: colors.text, marginVertical: 12 },
  pinActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  link: { color: colors.primaryDark, fontWeight: '700' },
  soon: { color: colors.muted },
  tm: { marginTop: 24, marginBottom: 12 },
});
