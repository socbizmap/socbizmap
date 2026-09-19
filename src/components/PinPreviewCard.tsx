import { StyleSheet, Text, View } from 'react-native';

import { CATEGORIES } from '@/src/categories';
import { PrimaryButton } from '@/src/components/ui';
import type { Pin } from '@/src/data/types';
import { formatKm, formatPay } from '@/src/geo';
import { t } from '@/src/i18n';
import { colors } from '@/src/theme';

export function PinPreviewCard({
  pin,
  onDetails,
}: {
  pin: Pin;
  onDetails: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === pin.category);
  const pay = formatPay(pin.payAmount);
  const place = [pin.city, pin.distanceM != null ? formatKm(pin.distanceM) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={2}>
        {pin.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {cat ? t(cat.label) : pin.category}
        {pay ? ` · ${pay}` : ''}
      </Text>
      {place ? (
        <Text style={styles.place} numberOfLines={1}>
          {place}
        </Text>
      ) : null}
      <PrimaryButton label={t('pinDetails')} onPress={onDetails} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 30,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.muted },
  place: { fontSize: 13, color: colors.muted, marginBottom: 6 },
});
