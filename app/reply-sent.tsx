import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Body, Muted, Screen, Title } from '@/src/components/ui';
import { t } from '@/src/i18n';

export default function ReplySentScreen() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  return (
    <Screen>
      <Title>{t('replySent')}</Title>
      <Body style={styles.lead}>{t('authorPhone')}</Body>
      <Title style={styles.phone}>{phone ?? ''}</Title>
      <Muted>Чата немає. Зателефонуйте автору мітки.</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: 16, marginBottom: 8 },
  phone: { fontSize: 28, marginBottom: 16 },
});
