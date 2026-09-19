import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Muted, Screen, Title } from '@/src/components/ui';
import type { ChatThread } from '@/src/data/types';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function ChatsScreen() {
  const { api, session } = useData();
  const [threads, setThreads] = useState<ChatThread[]>([]);

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }
    void api.listThreads().then(setThreads);
  }, [api, session]);

  return (
    <Screen>
      <ScrollView>
        <Title>{t('myChats')}</Title>
        {threads.length === 0 ? <Muted style={styles.empty}>{t('chatEmpty')}</Muted> : null}
        {threads.map((th) => (
          <Pressable
            key={`${th.pinId}:${th.peerId}`}
            style={styles.row}
            onPress={() => router.push(`/chat/${th.pinId}?peer=${th.peerId}`)}
          >
            <Text style={styles.peer} numberOfLines={1}>
              {th.peerName}
            </Text>
            <Text style={styles.pin} numberOfLines={1}>
              {t('threadAbout')}: {th.pinTitle}
            </Text>
            <Muted numberOfLines={2}>{th.lastBody ?? t('noChatYet')}</Muted>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { marginTop: 16 },
  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  peer: { fontSize: 16, fontWeight: '700', color: colors.text },
  pin: { fontSize: 13, color: colors.primaryDark, marginVertical: 4, fontWeight: '600' },
});
