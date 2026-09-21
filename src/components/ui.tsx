import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type PressableProps,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { colors, WEB_COLUMN_MAX_WIDTH } from '@/src/theme';

/** Extra room so the last control clears the home indicator on phone web. */
export function withBottomInset(extraPx: number): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      paddingBottom: `calc(${extraPx}px + env(safe-area-inset-bottom, 0px))` as DimensionValue,
    };
  }
  return { paddingBottom: extraPx };
}

export function Screen({ style, ...rest }: ViewProps) {
  return <View style={[styles.screen, Platform.OS === 'web' ? styles.webScreen : null, style]} {...rest} />;
}

export function Title({ style, ...rest }: TextProps) {
  return <Text style={[styles.title, style]} {...rest} />;
}

export function Body({ style, ...rest }: TextProps) {
  return <Text style={[styles.body, style]} {...rest} />;
}

export function Muted({ style, ...rest }: TextProps) {
  return <Text style={[styles.muted, style]} {...rest} />;
}

export function PrimaryButton({
  label,
  disabled,
  ...rest
}: PressableProps & { label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={[styles.btn, disabled ? styles.btnDisabled : null]}
      {...rest}
    >
      <Text style={styles.btnLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  ...rest
}: PressableProps & { label: string }) {
  return (
    <Pressable accessibilityRole="button" style={styles.ghost} {...rest}>
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 20,
  },
  webScreen: {
    width: '100%',
    maxWidth: WEB_COLUMN_MAX_WIDTH,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ghost: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostLabel: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
});
