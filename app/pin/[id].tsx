import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, STATUS_LABEL } from '@/src/categories';
import { Chip, GhostButton, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { DataError } from '@/src/data';
import type { Pin } from '@/src/data/types';
import { formatPay } from '@/src/geo';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function PinCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, session } = useData();
  const [pin, setPin] = useState<Pin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api.getPin(id).then(setPin);
  }, [api, id]);

  if (!pin) {
    return (
      <Screen>
        <Muted>…</Muted>
      </Screen>
    );
  }

  const own = session?.userId === pin.authorId;
  const cat = CATEGORIES.find((c) => c.id === pin.category);
  const pay = formatPay(pin.payAmount);
  const photo = pin.media.find((m) => m.kind === 'photo');
  const pinId = pin.id;

  async function openChat() {
    if (!session) {
      router.push('/login');
      return;
    }
    if (own) {
      router.push('/chats');
      return;
    }
    try {
      const { peerId } = await api.openPinThread(pinId);
      router.push(`/chat/${pinId}?peer=${encodeURIComponent(peerId)}`);
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Помилка');
    }
  }

  return (
    <Screen>
      <ScrollView>
        <View style={styles.photo}>
          <Text style={styles.photoText}>{photo ? '📷' : t('noPhoto')}</Text>
        </View>
        <Title>{pin.title}</Title>
        <Muted style={styles.meta}>
          {cat ? t(cat.label) : pin.category}
          {pay ? ` · ${pay}` : ''}
        </Muted>
        {own ? <Chip label={t(STATUS_LABEL[pin.status])} selected /> : null}
        <Text style={styles.body}>{pin.description}</Text>
        {pin.schedule ? <Muted>{pin.schedule}</Muted> : null}
        <Muted style={styles.city}>{pin.city}</Muted>
        <Muted style={styles.chatHint}>{t('chatInApp')}</Muted>
        {session && pin.contactPhone ? (
          <Text style={styles.phone}>{pin.contactPhone}</Text>
        ) : (
          <Muted>{t('needLogin')}</Muted>
        )}
        {pin.moderationNote && own ? <Muted>{pin.moderationNote}</Muted> : null}
        <View style={styles.actions}>
          {own ? (
            <>
              <GhostButton
                label={`✎ ${t('edit')}`}
                onPress={() => router.push(`/create?id=${pin.id}`)}
              />
              <GhostButton label={t('myChats')} onPress={() => router.push('/chats')} />
              {pin.status === 'live' ? (
                <Chip label={`${t('highlight')} · ${t('soon')}`} />
              ) : null}
            </>
          ) : (
            <PrimaryButton label={t('writeChat')} onPress={() => void openChat()} />
          )}
        </View>
        {error ? <Text style={styles.err}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: {
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  photoText: { color: colors.muted, fontSize: 16 },
  meta: { marginVertical: 8 },
  body: { fontSize: 16, color: colors.text, marginVertical: 12, lineHeight: 22 },
  city: { marginBottom: 8 },
  chatHint: { marginBottom: 8 },
  phone: { fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginVertical: 8 },
  actions: { marginTop: 20, gap: 12 },
  err: { color: colors.danger, marginTop: 12 },
});
