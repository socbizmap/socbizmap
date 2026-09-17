import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/src/i18n';
import { colors } from '@/src/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: t('appName') }} />
      <View style={styles.container}>
        <Text style={styles.title}>{t('notFound')}</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t('home')}</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.bg,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  link: { marginTop: 16, paddingVertical: 12 },
  linkText: { color: colors.primary, fontWeight: '700' },
});
