import { Pressable, StyleSheet, Text, View } from 'react-native';

import { STATUS_LABEL, CATEGORIES } from '@/src/categories';
import type { Pin } from '@/src/data/types';
import { formatKm, formatPay } from '@/src/geo';
import { t } from '@/src/i18n';
import { colors } from '@/src/theme';

export function PinRow({
  pin,
  onPress,
  showStatus,
}: {
  pin: Pin;
  onPress?: () => void;
  showStatus?: boolean;
}) {
  const cat = CATEGORIES.find((c) => c.id === pin.category);
  const pay = formatPay(pin.payAmount);
  const thumb = pin.thumbnailPath || pin.media.find((m) => m.kind === 'photo')?.path;
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.thumb}>
        <Text style={styles.thumbText}>{thumb ? '📷' : t('noPhoto')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {pin.title}
        </Text>
        <Text style={styles.meta}>
          {cat ? t(cat.label) : pin.category}
          {pay ? ` · ${pay}` : ''}
          {pin.distanceM != null ? ` · ${formatKm(pin.distanceM)}` : ''}
        </Text>
        {showStatus ? (
          <Text style={styles.status}>{t(STATUS_LABEL[pin.status])}</Text>
        ) : null}
        {pin.boostUntil ? <Text style={styles.boost}>✦</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  thumbText: { fontSize: 11, color: colors.muted, textAlign: 'center' },
  body: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  status: { fontSize: 12, color: colors.primaryDark, marginTop: 4, fontWeight: '600' },
  boost: { position: 'absolute', right: 0, top: 0, color: colors.warn },
});
