import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Body, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { t } from '@/src/i18n';

export default function ReplySentScreen() {
  const { phone, pinId, peer } = useLocalSearchParams<{
    phone?: string;
    pinId?: string;
    peer?: string;
  }>();
  return (
    <Screen>
      <Title>{t('replySent')}</Title>
      <Body style={styles.lead}>{t('chatInApp')}</Body>
      {phone ? (
        <>
          <Muted>{t('authorPhone')}</Muted>
          <Title style={styles.phone}>{phone}</Title>
        </>
      ) : null}
      {pinId && peer ? (
        <PrimaryButton
          label={t('writeChat')}
          onPress={() => router.replace(`/chat/${pinId}?peer=${encodeURIComponent(peer)}`)}
        />
      ) : (
        <PrimaryButton label={t('myChats')} onPress={() => router.replace('/chats')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: 16, marginBottom: 8 },
  phone: { fontSize: 28, marginBottom: 16 },
});
