import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Chip, Muted, Screen, Title } from '@/src/components/ui';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function StartScreen() {
  const { session, api } = useData();

  async function go(vertical: 'work' | 'service') {
    if (session) {
      await api.updateProfile({ vertical });
    }
    router.replace(`/map?vertical=${vertical}`);
  }

  return (
    <Screen>
      <Title>{t('startQuestion')}</Title>
      <Body style={styles.lead}>{t('startLead')}</Body>
      <View style={styles.btns}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('work')}
          onPress={() => void go('work')}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>{t('work')}</Text>
          <Text style={styles.cardHint}>{t('workHint')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('services')}
          onPress={() => void go('service')}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>{t('services')}</Text>
          <Text style={styles.cardHint}>{t('servicesHint')}</Text>
        </Pressable>
      </View>
      <View style={styles.soon}>
        <Chip label={`${t('flea')} · ${t('soon')}`} />
      </View>
      <Muted>{t('tm')}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: 12, marginBottom: 28 },
  btns: { gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  cardTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    fontSize: 22,
    marginBottom: 6,
  },
  cardHint: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  soon: { marginTop: 24, marginBottom: 24 },
});
