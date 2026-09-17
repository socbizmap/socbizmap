import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PinRow } from '@/src/components/PinRow';
import { Chip, Muted, Screen, Title } from '@/src/components/ui';
import type { Pin } from '@/src/data/types';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function AdminScreen() {
  const { api, profile } = useData();
  const [pins, setPins] = useState<Pin[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setPins(await api.listModerationQueue());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка');
    }
  }

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.replace('/profile');
      return;
    }
    void reload();
  }, [api, profile]);

  async function act(id: string, status: 'live' | 'revision' | 'rejected') {
    await api.moderatePin(id, status, note || undefined);
    setNote('');
    await reload();
  }

  return (
    <Screen>
      <Title>{t('adminQueue')}</Title>
      <Muted style={styles.hint}>pending → live / revision / rejected</Muted>
      {error ? <Muted>{error}</Muted> : null}
      <TextInput
        style={styles.note}
        placeholder={t('moderationNote')}
        placeholderTextColor={colors.muted}
        value={note}
        onChangeText={setNote}
      />
      <ScrollView>
        {pins.map((p) => (
          <View key={p.id} style={styles.card}>
            <PinRow pin={p} showStatus onPress={() => router.push(`/pin/${p.id}`)} />
            <View style={styles.row}>
              <Chip label={t('approve')} onPress={() => void act(p.id, 'live')} />
              <Chip label={t('sendRevision')} onPress={() => void act(p.id, 'revision')} />
              <Chip label={t('reject')} onPress={() => void act(p.id, 'rejected')} />
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { marginVertical: 8 },
  note: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.text,
    marginBottom: 12,
  },
  card: { marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
