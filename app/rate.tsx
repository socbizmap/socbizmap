import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { DataError } from '@/src/data';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function RateScreen() {
  const { api } = useData();
  const params = useLocalSearchParams<{ pinId?: string; toId?: string }>();
  const [stars, setStars] = useState(5);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!params.pinId || !params.toId) return;
    try {
      await api.rate(params.pinId, params.toId, stars);
      router.back();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Помилка');
    }
  }

  return (
    <Screen>
      <Title>{t('rate')}</Title>
      <Body style={styles.lead}>Після підтвердженої роботи. Один раз на пару мітка × людина.</Body>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)}>
            <Text style={[styles.star, n <= stars ? styles.on : null]}>★</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Muted style={styles.err}>{error}</Muted> : null}
      <PrimaryButton label={t('save')} onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginVertical: 16 },
  stars: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  star: { fontSize: 36, color: colors.border },
  on: { color: colors.warn },
  err: { color: colors.danger, marginBottom: 12 },
});
