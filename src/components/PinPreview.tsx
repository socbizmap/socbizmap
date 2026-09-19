import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pinSnippet } from '@/src/components/PinRow';
import { PrimaryButton } from '@/src/components/ui';
import type { Pin } from '@/src/data/types';
import { t } from '@/src/i18n';
import { colors } from '@/src/theme';

/** Short map bottom card: title + category/pay/distance. Only «Детально» opens `/pin/[id]`. */
export function PinPreview({
  pin,
  onDetails,
  onDismiss,
}: {
  pin: Pin;
  onDetails: () => void;
  onDismiss?: () => void;
}) {
  return (
    <Pressable
      style={styles.sheet}
      onPress={(e) => e.stopPropagation?.()}
    >
      <View style={styles.head}>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={2}>
            {pin.title}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {pinSnippet(pin)}
          </Text>
        </View>
        {onDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрити"
            onPress={onDismiss}
            hitSlop={8}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <PrimaryButton
        accessibilityLabel={t('details')}
        label={t('details')}
        onPress={onDetails}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  copy: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  close: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  closeText: { color: colors.primaryDark, fontSize: 20, lineHeight: 22, fontWeight: '700' },
});
