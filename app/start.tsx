import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Chip, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';

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
      <Title>Що шукаєш сьогодні</Title>
      <Body style={styles.lead}>Оберіть доріжку. Барахолка поки не доступна.</Body>
      <View style={styles.btns}>
        <PrimaryButton label={t('work')} onPress={() => void go('work')} />
        <PrimaryButton label={t('services')} onPress={() => void go('service')} />
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
  soon: { marginTop: 24, marginBottom: 24 },
});
